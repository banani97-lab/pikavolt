import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/models/db_models.dart';
import '../../core/supabase_provider.dart';

/// The signed-in customer's saved addresses (default first).
///
/// Mutations go through [AddressRepository]; call
/// `ref.invalidate(myAddressesProvider)` afterwards.
final myAddressesProvider = FutureProvider<List<Address>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return const [];
  final client = ref.watch(supabaseClientProvider);
  final rows = await client
      .from('addresses')
      .select()
      .eq('user_id', user.id)
      .order('is_default', ascending: false)
      .order('created_at', ascending: true);
  return (rows as List<dynamic>)
      .map((r) => Address.fromJson(r as Map<String, dynamic>))
      .toList();
});

/// CRUD against the `addresses` table (RLS: user owns rows).
class AddressRepository {
  const AddressRepository(this._ref);

  final Ref _ref;

  Future<Address> create({
    String? label,
    required String line1,
    String? line2,
    required String city,
    String state = 'OH',
    required String zip,
    String propertyType = 'residential',
    bool isDefault = false,
  }) async {
    final client = _ref.read(supabaseClientProvider);
    final userId = client.auth.currentUser!.id;
    if (isDefault) await _clearDefault(userId);
    final row = await client
        .from('addresses')
        .insert({
          'user_id': userId,
          'label': label,
          'line1': line1,
          'line2': line2,
          'city': city,
          'state': state,
          'zip': zip,
          'property_type': propertyType,
          'is_default': isDefault,
        })
        .select()
        .single();
    _ref.invalidate(myAddressesProvider);
    return Address.fromJson(row);
  }

  Future<void> update(
    String id, {
    String? label,
    required String line1,
    String? line2,
    required String city,
    String state = 'OH',
    required String zip,
    String propertyType = 'residential',
    bool isDefault = false,
  }) async {
    final client = _ref.read(supabaseClientProvider);
    if (isDefault) await _clearDefault(client.auth.currentUser!.id);
    await client.from('addresses').update({
      'label': label,
      'line1': line1,
      'line2': line2,
      'city': city,
      'state': state,
      'zip': zip,
      'property_type': propertyType,
      'is_default': isDefault,
    }).eq('id', id);
    _ref.invalidate(myAddressesProvider);
  }

  Future<void> delete(String id) async {
    final client = _ref.read(supabaseClientProvider);
    await client.from('addresses').delete().eq('id', id);
    _ref.invalidate(myAddressesProvider);
  }

  Future<void> _clearDefault(String userId) async {
    final client = _ref.read(supabaseClientProvider);
    await client
        .from('addresses')
        .update({'is_default': false}).eq('user_id', userId);
  }
}

final addressRepositoryProvider =
    Provider<AddressRepository>((ref) => AddressRepository(ref));

/// Updates the signed-in user's profile row.
class ProfileRepository {
  const ProfileRepository(this._ref);

  final Ref _ref;

  Future<void> updateProfile({String? fullName, String? phone}) async {
    final client = _ref.read(supabaseClientProvider);
    final userId = client.auth.currentUser!.id;
    await client.from('profiles').update({
      'full_name': fullName,
      'phone': phone,
    }).eq('id', userId);
    _ref.invalidate(currentProfileProvider);
  }
}

final profileRepositoryProvider =
    Provider<ProfileRepository>((ref) => ProfileRepository(ref));
