/// OwnerTripService — the owner-side live tracking engine.
///
/// Started by "ON MY WAY" (confirmed -> en_route) and stopped by "ARRIVED"
/// (en_route -> in_progress), job complete/cancel/no-show, sign-out, or the
/// 2 h safety timeout. While running it:
///
/// - streams geolocator positions (high accuracy, 25 m distance filter,
///   Android foreground-service notification / iOS background updates),
/// - broadcasts `ping` events on the private realtime channel
///   `tracking:{appointment_id}` per the frozen contract (see
///   [TrackingPing]), throttled by [TripThrottle],
/// - upserts the `tracking_sessions` snapshot every ~30 s,
/// - survives screen navigation (non-autodispose Riverpod notifier) and is
///   torn down on sign-out.
///
/// Realtime auth note (verified against supabase 2.14 source,
/// `SupabaseClient._handleTokenChanged`): supabase-dart already calls
/// `realtime.setAuth(token)` on initialSession / signedIn / tokenRefreshed,
/// so private channels are authorized after session restore. We still call
/// `setAuth` explicitly right before subscribing as cheap belt-and-braces.
library;

import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_provider.dart';
import 'trip_throttle.dart';

/// Immutable state exposed to the UI (streaming banner, buttons).
class OwnerTripState {
  const OwnerTripState({
    this.appointmentId,
    this.startedAt,
    this.lastPing,
    this.pingCount = 0,
    this.error,
  });

  const OwnerTripState.idle() : this();

  /// Appointment currently being streamed, or null when idle.
  final String? appointmentId;
  final DateTime? startedAt;
  final TrackingPing? lastPing;
  final int pingCount;

  /// Last non-fatal error (stream hiccup, failed upsert) for display.
  final String? error;

  bool get isActive => appointmentId != null;

  bool isActiveFor(String id) => appointmentId == id;

  OwnerTripState copyWith({
    TrackingPing? lastPing,
    int? pingCount,
    String? error,
  }) =>
      OwnerTripState(
        appointmentId: appointmentId,
        startedAt: startedAt,
        lastPing: lastPing ?? this.lastPing,
        pingCount: pingCount ?? this.pingCount,
        error: error,
      );
}

/// Result of [OwnerTripService.start].
enum TripStartResult { started, permissionDenied, serviceDisabled, failed }

class OwnerTripService extends Notifier<OwnerTripState> {
  StreamSubscription<Position>? _positionSub;
  Timer? _heartbeatTimer;
  Timer? _snapshotTimer;
  Timer? _autoStopTimer;
  RealtimeChannel? _channel;
  TripThrottle? _throttle;
  Position? _lastPosition;

  @override
  OwnerTripState build() {
    // Teardown on sign-out. The notifier itself is app-lifetime (non
    // autodispose), so the trip survives navigation between screens.
    ref.listen<Session?>(sessionProvider, (previous, next) {
      if (next == null && state.isActive) {
        unawaited(stop(endSession: true));
      }
    });
    return const OwnerTripState.idle();
  }

  SupabaseClient get _client => ref.read(supabaseClientProvider);

  /// Checks + requests location permission. `whileInUse` is sufficient.
  ///
  /// Kept public so the UI can pre-flight before committing the status
  /// transition ("confirm dialog if location permission missing").
  Future<TripStartResult> ensurePermission() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return TripStartResult.serviceDisabled;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return TripStartResult.permissionDenied;
      }
      return TripStartResult.started;
    } catch (e) {
      debugPrint('OwnerTripService: permission check failed: $e');
      return TripStartResult.failed;
    }
  }

  /// Starts streaming for [appointmentId]. Creates/reopens the
  /// `tracking_sessions` row, joins the private broadcast channel, and starts
  /// the geolocator stream + heartbeat/snapshot/safety timers.
  Future<TripStartResult> start(String appointmentId) async {
    if (state.isActiveFor(appointmentId)) return TripStartResult.started;
    if (state.isActive) await stop(endSession: true);

    final permission = await ensurePermission();
    if (permission != TripStartResult.started) return permission;

    final now = DateTime.now().toUtc();
    try {
      // Create (or reopen) the session snapshot row. Unique on
      // appointment_id; owner RLS allows insert/update.
      await _client.from('tracking_sessions').upsert(
        {
          'appointment_id': appointmentId,
          'started_at': now.toIso8601String(),
          'ended_at': null,
        },
        onConflict: 'appointment_id',
      );
    } catch (e) {
      debugPrint('OwnerTripService: tracking_sessions upsert failed: $e');
      return TripStartResult.failed;
    }

    try {
      // See the library docs: supabase-dart sets realtime auth automatically;
      // this explicit call is defensive.
      await _client.realtime
          .setAuth(_client.auth.currentSession?.accessToken);

      final channel = _client.channel(
        'tracking:$appointmentId',
        opts: const RealtimeChannelConfig(private: true),
      );
      final joined = Completer<bool>();
      channel.subscribe((status, error) {
        if (status == RealtimeSubscribeStatus.subscribed) {
          if (!joined.isCompleted) joined.complete(true);
        } else if (status == RealtimeSubscribeStatus.channelError ||
            status == RealtimeSubscribeStatus.timedOut) {
          debugPrint('OwnerTripService: channel $status $error');
          if (!joined.isCompleted) joined.complete(false);
        }
      });
      final ok = await joined.future
          .timeout(const Duration(seconds: 10), onTimeout: () => false);
      if (!ok) {
        await _client.removeChannel(channel);
        return TripStartResult.failed;
      }
      _channel = channel;
    } catch (e) {
      debugPrint('OwnerTripService: channel join failed: $e');
      return TripStartResult.failed;
    }

    _throttle = TripThrottle(startedAt: now);
    state = OwnerTripState(appointmentId: appointmentId, startedAt: now);

    _positionSub = Geolocator.getPositionStream(
      locationSettings: _locationSettings(),
    ).listen(_onPosition, onError: (Object e) {
      debugPrint('OwnerTripService: position stream error: $e');
      state = state.copyWith(error: 'Location signal lost — retrying…');
    });

    // Stationary heartbeat: checked every 5 s, fires at most every 30 s.
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      final position = _lastPosition;
      final throttle = _throttle;
      if (position == null || throttle == null) return;
      final wallNow = DateTime.now().toUtc();
      if (throttle.isExpired(wallNow)) {
        unawaited(stop(endSession: true));
        return;
      }
      if (throttle.shouldHeartbeat(wallNow)) {
        unawaited(_emitPing(position, wallNow));
      }
    });

    // Snapshot upsert every ~30 s.
    _snapshotTimer = Timer.periodic(TripLimits.snapshotEvery, (_) {
      unawaited(_upsertSnapshot());
    });

    // 2 h safety timeout (also enforced in the heartbeat check above).
    _autoStopTimer = Timer(TripLimits.maxTripDuration, () {
      unawaited(stop(endSession: true));
    });

    return TripStartResult.started;
  }

  /// Stops streaming. When [endSession] is true the `tracking_sessions` row
  /// gets `ended_at` plus a final snapshot (Arrived / complete / cancel /
  /// sign-out / timeout).
  Future<void> stop({required bool endSession}) async {
    final appointmentId = state.appointmentId;
    final lastPing = state.lastPing;

    await _positionSub?.cancel();
    _positionSub = null;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _snapshotTimer?.cancel();
    _snapshotTimer = null;
    _autoStopTimer?.cancel();
    _autoStopTimer = null;
    final channel = _channel;
    _channel = null;
    _throttle = null;
    _lastPosition = null;
    state = const OwnerTripState.idle();

    if (channel != null) {
      try {
        await _client.removeChannel(channel);
      } catch (e) {
        debugPrint('OwnerTripService: channel teardown failed: $e');
      }
    }

    if (endSession && appointmentId != null) {
      try {
        await _client.from('tracking_sessions').update({
          'ended_at': DateTime.now().toUtc().toIso8601String(),
          if (lastPing != null) ...{
            'last_lat': lastPing.lat,
            'last_lng': lastPing.lng,
            'last_heading': lastPing.heading,
            'last_ping_at': lastPing.ts.toUtc().toIso8601String(),
          },
        }).eq('appointment_id', appointmentId);
      } catch (e) {
        debugPrint('OwnerTripService: ended_at update failed: $e');
      }
    }
  }

  void _onPosition(Position position) {
    _lastPosition = position;
    final throttle = _throttle;
    if (throttle == null) return;
    final now = DateTime.now().toUtc();
    if (throttle.isExpired(now)) {
      unawaited(stop(endSession: true));
      return;
    }
    if (throttle.shouldPingForMovement(
      lat: position.latitude,
      lng: position.longitude,
      now: now,
    )) {
      unawaited(_emitPing(position, now));
    }
  }

  Future<void> _emitPing(Position position, DateTime now) async {
    final channel = _channel;
    final throttle = _throttle;
    if (channel == null || throttle == null) return;

    // Geolocator reports -1 / 0-ish sentinel values when heading/speed are
    // unknown; the contract wants explicit nulls.
    final heading = position.heading;
    final speed = position.speed;
    final ping = TrackingPing(
      lat: position.latitude,
      lng: position.longitude,
      heading: heading.isNaN || heading < 0 ? null : heading,
      speed: speed.isNaN || speed < 0 ? null : speed,
      ts: now,
    );

    throttle.recordPing(
      lat: position.latitude,
      lng: position.longitude,
      now: now,
    );
    state = state.copyWith(lastPing: ping, pingCount: state.pingCount + 1);

    try {
      await channel.sendBroadcastMessage(event: 'ping', payload: ping.toJson());
    } catch (e) {
      debugPrint('OwnerTripService: ping broadcast failed: $e');
      state = state.copyWith(error: 'Live update failed — retrying…');
    }
  }

  Future<void> _upsertSnapshot() async {
    final appointmentId = state.appointmentId;
    final ping = state.lastPing;
    final throttle = _throttle;
    if (appointmentId == null || ping == null || throttle == null) return;
    final now = DateTime.now().toUtc();
    if (!throttle.shouldSnapshot(now)) return;
    throttle.recordSnapshot(now);
    try {
      await _client.from('tracking_sessions').update({
        'last_lat': ping.lat,
        'last_lng': ping.lng,
        'last_heading': ping.heading,
        'last_ping_at': ping.ts.toUtc().toIso8601String(),
      }).eq('appointment_id', appointmentId);
    } catch (e) {
      debugPrint('OwnerTripService: snapshot upsert failed: $e');
    }
  }

  LocationSettings _locationSettings() {
    if (Platform.isAndroid) {
      return AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: TripLimits.minDistanceMeters.toInt(),
        intervalDuration: TripLimits.minPingGap,
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'Pikavolt live tracking',
          notificationText:
              'Pikavolt is sharing your trip with the customer',
          setOngoing: true,
          enableWakeLock: true,
        ),
      );
    }
    if (Platform.isIOS || Platform.isMacOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: TripLimits.minDistanceMeters.toInt(),
        activityType: ActivityType.automotiveNavigation,
        allowBackgroundLocationUpdates: true,
        showBackgroundLocationIndicator: true,
        pauseLocationUpdatesAutomatically: false,
      );
    }
    return LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: TripLimits.minDistanceMeters.toInt(),
    );
  }
}

/// App-lifetime trip service — the trip keeps streaming while the owner
/// navigates around the app.
final ownerTripProvider =
    NotifierProvider<OwnerTripService, OwnerTripState>(OwnerTripService.new);
