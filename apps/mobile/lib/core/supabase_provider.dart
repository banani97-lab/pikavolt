import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'constants.dart';

/// The initialized Supabase client (requires `Supabase.initialize` in main).
final supabaseClientProvider = Provider<SupabaseClient>(
  (ref) => Supabase.instance.client,
);

/// Emits on every auth event (sign in, sign out, token refresh, ...).
final authStateChangesProvider = StreamProvider<AuthState>(
  (ref) => ref.watch(supabaseClientProvider).auth.onAuthStateChange,
);

/// The current session, re-evaluated on every auth event.
final sessionProvider = Provider<Session?>((ref) {
  ref.watch(authStateChangesProvider);
  return ref.watch(supabaseClientProvider).auth.currentSession;
});

/// The currently signed-in user, or null.
final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(sessionProvider)?.user;
});

/// Minimal profile model backed by the `profiles` table.
class Profile {
  const Profile({
    required this.id,
    required this.role,
    this.fullName,
    this.phone,
  });

  final String id;
  final UserRole role;
  final String? fullName;
  final String? phone;

  factory Profile.fromJson(Map<String, dynamic> json) => Profile(
        id: json['id'] as String,
        role: UserRole.fromWire(json['role'] as String?),
        fullName: json['full_name'] as String?,
        phone: json['phone'] as String?,
      );
}

/// Fetches the signed-in user's profile (including `role`) from `profiles`.
///
/// Returns null when signed out. If the row is missing or the query fails
/// (e.g. local stack not migrated yet), falls back to a customer-role profile
/// so the app remains navigable during development.
final currentProfileProvider = FutureProvider<Profile?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;

  final client = ref.watch(supabaseClientProvider);
  try {
    final row = await client
        .from('profiles')
        .select('id, role, full_name, phone')
        .eq('id', user.id)
        .maybeSingle();
    if (row == null) {
      return Profile(id: user.id, role: UserRole.customer);
    }
    return Profile.fromJson(row);
  } catch (_) {
    // Profile fetch failed (network, missing table during early dev, ...).
    // Default to customer so the router can still resolve a home screen.
    return Profile(id: user.id, role: UserRole.customer);
  }
});
