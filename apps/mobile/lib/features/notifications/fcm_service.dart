import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart'
    show AuthChangeEvent;

import '../../core/supabase_provider.dart';
import '../../router.dart';

/// Firebase Cloud Messaging + foreground notifications.
///
/// Safe in every environment: all methods no-op when Firebase has not been
/// initialized (i.e. before google-services.json / GoogleService-Info.plist
/// are added and --dart-define=HAS_FIREBASE_CONFIG=true is set — see
/// main.dart and core/env.dart).
class FcmService {
  FcmService(this._ref);

  final Ref _ref;
  final _localNotifications = FlutterLocalNotificationsPlugin();
  String? _currentToken;
  bool _initialized = false;

  static const _channel = AndroidNotificationChannel(
    'pikavolt_default',
    'Pikavolt notifications',
    description: 'Booking updates, technician tracking, and chat messages.',
    importance: Importance.high,
  );

  /// Whether Firebase was successfully initialized at startup.
  static bool get isAvailable => Firebase.apps.isNotEmpty;

  Future<void> init() async {
    if (!isAvailable) {
      debugPrint(
        'FcmService: Firebase not configured — push notifications disabled. '
        'Add google-services.json / GoogleService-Info.plist and set '
        '--dart-define=HAS_FIREBASE_CONFIG=true to enable.',
      );
      return;
    }
    if (_initialized) return;
    _initialized = true;

    final messaging = FirebaseMessaging.instance;

    // Permission (iOS prompt; Android 13+ POST_NOTIFICATIONS).
    final settings = await messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('FcmService: notification permission denied.');
    }

    // Foreground presentation via flutter_local_notifications.
    await _localNotifications.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (response) {
        final route = response.payload;
        if (route != null && route.isNotEmpty) _navigate(route);
      },
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);

    // Register the current token, follow refreshes and sign-ins.
    _currentToken = await messaging.getToken();
    await _upsertToken(_currentToken);
    messaging.onTokenRefresh.listen((token) {
      _currentToken = token;
      _upsertToken(token);
    });
    _ref.read(supabaseClientProvider).auth.onAuthStateChange.listen((state) {
      if (state.event == AuthChangeEvent.signedIn) {
        _upsertToken(_currentToken);
      }
    });

    // Foreground messages -> local notification.
    FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      _localNotifications.show(
        id: message.hashCode,
        title: notification?.title ?? 'Pikavolt',
        body: notification?.body ?? '',
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            _channel.id,
            _channel.name,
            channelDescription: _channel.description,
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        payload: routeForMessageData(message.data),
      );
    });

    // Background/terminated taps.
    FirebaseMessaging.onMessageOpenedApp
        .listen((message) => _navigate(routeForMessageData(message.data)));
    final initial = await messaging.getInitialMessage();
    if (initial != null) _navigate(routeForMessageData(initial.data));
  }

  /// Maps a push payload's `data` to an in-app route.
  ///
  /// Types (contract with the web/API notification sender):
  /// - `new_message` -> chat
  /// - `booking_confirmed` / `tech_en_route` / `final_payment_due`
  ///   -> appointment detail (requires `appointmentId`)
  @visibleForTesting
  static String routeForMessageData(Map<String, dynamic> data) {
    final type = data['type'] as String?;
    final appointmentId = data['appointmentId'] as String?;
    return switch (type) {
      'new_message' => '/customer/chat',
      'booking_confirmed' ||
      'tech_en_route' ||
      'final_payment_due' when appointmentId != null =>
        '/customer/appointments/$appointmentId',
      _ => '/customer/home',
    };
  }

  void _navigate(String route) {
    try {
      _ref.read(routerProvider).go(route);
    } catch (e) {
      debugPrint('FcmService: navigation failed for $route: $e');
    }
  }

  /// Upserts the token into `device_tokens` for the signed-in user.
  Future<void> _upsertToken(String? token) async {
    if (token == null) return;
    final client = _ref.read(supabaseClientProvider);
    final userId = client.auth.currentUser?.id;
    if (userId == null) return;
    try {
      await client.from('device_tokens').upsert(
        {
          'user_id': userId,
          'fcm_token': token,
          'platform': Platform.isIOS ? 'ios' : 'android',
          'last_seen_at': DateTime.now().toUtc().toIso8601String(),
        },
        onConflict: 'fcm_token',
      );
    } catch (e) {
      debugPrint('FcmService: token upsert failed: $e');
    }
  }

  /// Deletes this device's token row. Call BEFORE signing out — RLS blocks
  /// the delete once the session is gone.
  Future<void> unregisterToken() async {
    if (!isAvailable) return;
    final token = _currentToken ?? await FirebaseMessaging.instance.getToken();
    if (token == null) return;
    try {
      await _ref
          .read(supabaseClientProvider)
          .from('device_tokens')
          .delete()
          .eq('fcm_token', token);
    } catch (e) {
      debugPrint('FcmService: token delete failed: $e');
    }
  }
}

final fcmServiceProvider = Provider<FcmService>((ref) => FcmService(ref));
