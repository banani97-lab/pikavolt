import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import 'core/constants.dart';
import 'core/supabase_provider.dart';
import 'core/theme.dart';
import 'features/account/account_screen.dart';
import 'features/appointments/appointment_detail_screen.dart';
import 'features/appointments/appointments_list_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/signup_screen.dart';
import 'features/booking/booking_screen.dart';
import 'features/chat/customer_chat_screen.dart';
import 'features/chat/owner_chat_list_screen.dart';
import 'features/chat/owner_conversation_screen.dart';
import 'features/home/customer_home_screen.dart';
import 'features/owner/owner_appointment_detail_screen.dart';
import 'features/owner/owner_today_screen.dart';
import 'features/tracking/customer_map_screen.dart';

/// App router with auth + role-based redirects.
///
/// - Signed out          -> /login (or /signup)
/// - Signed in, role
///   still loading       -> /splash
/// - role == customer    -> /customer/... (owner routes blocked)
/// - role == owner       -> /owner/...    (customer routes blocked)
final routerProvider = Provider<GoRouter>((ref) {
  // Watching these re-creates the router (and re-runs redirects) on every
  // auth event and when the profile (role) resolves.
  final session = ref.watch(sessionProvider);
  final profileAsync = ref.watch(currentProfileProvider);

  String homeFor(UserRole role) =>
      role == UserRole.owner ? '/owner/today' : '/customer/home';

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final location = state.matchedLocation;
      final onAuthScreen = location == '/login' || location == '/signup';

      if (session == null) {
        return onAuthScreen ? null : '/login';
      }

      final profile = profileAsync.value;
      if (profile == null) {
        // Signed in but role not resolved yet — hold on splash.
        return location == '/splash' ? null : '/splash';
      }

      final home = homeFor(profile.role);
      if (onAuthScreen || location == '/splash') return home;

      // Block cross-role access.
      if (profile.role == UserRole.customer && location.startsWith('/owner')) {
        return home;
      }
      if (profile.role == UserRole.owner && location.startsWith('/customer')) {
        return home;
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/signup',
        builder: (context, state) => const SignupScreen(),
      ),

      // ---- Customer ----
      GoRoute(
        path: '/customer/home',
        builder: (context, state) => const CustomerHomeScreen(),
      ),
      GoRoute(
        path: '/customer/book',
        builder: (context, state) => const BookingScreen(),
      ),
      GoRoute(
        path: '/customer/appointments',
        builder: (context, state) => const AppointmentsListScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) => AppointmentDetailScreen(
              appointmentId: state.pathParameters['id']!,
            ),
            routes: [
              GoRoute(
                path: 'track',
                builder: (context, state) => CustomerMapScreen(
                  appointmentId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/customer/chat',
        builder: (context, state) => const CustomerChatScreen(),
      ),
      GoRoute(
        path: '/customer/account',
        builder: (context, state) => const AccountScreen(),
      ),

      // ---- Owner ----
      GoRoute(
        path: '/owner/today',
        builder: (context, state) => const OwnerTodayScreen(),
      ),
      GoRoute(
        path: '/owner/appointments/:id',
        builder: (context, state) => OwnerAppointmentDetailScreen(
          appointmentId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/owner/chat',
        builder: (context, state) => const OwnerChatListScreen(),
        routes: [
          GoRoute(
            path: ':conversationId',
            builder: (context, state) => OwnerConversationScreen(
              conversationId: state.pathParameters['conversationId']!,
            ),
          ),
        ],
      ),
    ],
  );
});

/// Shown while the signed-in user's role is being resolved.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.bolt_rounded, size: 72, color: AppColors.voltYellow),
            SizedBox(height: 24),
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 3),
            ),
          ],
        ),
      ),
    );
  }
}
