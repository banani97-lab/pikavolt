import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'core/env.dart';
import 'core/time.dart';
import 'features/notifications/fcm_service.dart';
import 'features/payments/payments_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Must run before any appointment/slot time is parsed — those render in
  // Ohio time regardless of the device's timezone (see core/time.dart).
  initBusinessTime();

  await Supabase.initialize(
    url: Env.supabaseUrl,
    // supabase_flutter 2.16 renamed `anonKey` -> `publishableKey`; legacy
    // anon keys (including the local-dev demo key) are accepted here.
    publishableKey: Env.supabaseAnonKey,
  );

  // Stripe publishable key (no-op without STRIPE_PUBLISHABLE_KEY dart-define).
  await const PaymentsService().init();

  // A container we control so FCM can navigate via routerProvider.
  final container = ProviderContainer();

  await _initFirebase(container);

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const PikavoltApp(),
    ),
  );
}

/// Guarded Firebase init: the config files are not in the repo yet
/// (android/app/google-services.json and ios/Runner/GoogleService-Info.plist
/// — see the TODO placeholders in those directories), so initialization is
/// expected to fail locally. The app must keep working without push
/// notifications until they are added.
///
/// TODO(firebase): add the config files via `flutterfire configure`, then set
/// --dart-define=HAS_FIREBASE_CONFIG=true (see core/env.dart).
Future<void> _initFirebase(ProviderContainer container) async {
  if (!Env.hasFirebaseConfig) {
    debugPrint('Firebase config not present — skipping Firebase init.');
    return;
  }
  try {
    await Firebase.initializeApp();
    await container.read(fcmServiceProvider).init();
  } catch (e) {
    debugPrint('Firebase init failed (continuing without push): $e');
  }
}
