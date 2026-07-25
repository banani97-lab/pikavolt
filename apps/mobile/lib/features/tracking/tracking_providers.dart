/// Customer-side tracking providers, shared by the Google Maps screen and the
/// branded radar fallback so switching between them is trivial.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/supabase_provider.dart';
import 'trip_throttle.dart';

/// Snapshot row from `tracking_sessions` (RLS: readable by that
/// appointment's customer and the owner).
class TrackingSessionSnapshot {
  const TrackingSessionSnapshot({
    required this.appointmentId,
    required this.startedAt,
    this.endedAt,
    this.lastLat,
    this.lastLng,
    this.lastHeading,
    this.lastPingAt,
    this.etaSeconds,
  });

  final String appointmentId;
  final DateTime startedAt;
  final DateTime? endedAt;
  final double? lastLat;
  final double? lastLng;
  final double? lastHeading;
  final DateTime? lastPingAt;
  final int? etaSeconds;

  bool get isLive => endedAt == null;

  factory TrackingSessionSnapshot.fromJson(Map<String, dynamic> json) =>
      TrackingSessionSnapshot(
        appointmentId: json['appointment_id'] as String,
        startedAt: DateTime.parse(json['started_at'] as String),
        endedAt: json['ended_at'] == null
            ? null
            : DateTime.parse(json['ended_at'] as String),
        lastLat: (json['last_lat'] as num?)?.toDouble(),
        lastLng: (json['last_lng'] as num?)?.toDouble(),
        lastHeading: (json['last_heading'] as num?)?.toDouble(),
        lastPingAt: json['last_ping_at'] == null
            ? null
            : DateTime.parse(json['last_ping_at'] as String),
        etaSeconds: (json['eta_seconds'] as num?)?.toInt(),
      );
}

/// Live `tracking_sessions` row for an appointment (realtime; also delivers
/// the initial snapshot before any broadcast ping arrives).
final trackingSessionProvider =
    StreamProvider.family<TrackingSessionSnapshot?, String>(
        (ref, appointmentId) {
  final client = ref.watch(supabaseClientProvider);
  return client
      .from('tracking_sessions')
      .stream(primaryKey: ['id'])
      .eq('appointment_id', appointmentId)
      .map((rows) => rows.isEmpty
          ? null
          : TrackingSessionSnapshot.fromJson(rows.first));
});

/// Broadcast `ping` stream on the private channel
/// `tracking:{appointment_id}` (frozen contract — see [TrackingPing]).
///
/// Emits each ping as it arrives. Errors (e.g. RLS denies a stranger) surface
/// as an [AsyncError] on the provider.
final trackingPingsProvider =
    StreamProvider.family<TrackingPing, String>((ref, appointmentId) {
  final client = ref.watch(supabaseClientProvider);
  final controller = StreamController<TrackingPing>();

  final channel = client.channel(
    'tracking:$appointmentId',
    opts: const RealtimeChannelConfig(private: true),
  );
  channel.onBroadcast(
    event: 'ping',
    callback: (payload) {
      // realtime_client delivers the whole broadcast message
      // ({event, type, payload: {...}}); tolerate the bare payload too.
      final inner = payload['payload'];
      final map = inner is Map
          ? Map<String, dynamic>.from(inner)
          : payload;
      try {
        controller.add(TrackingPing.fromJson(map));
      } catch (e) {
        debugPrint('trackingPingsProvider: bad ping payload: $e');
      }
    },
  );

  // supabase-dart authorizes realtime automatically on sign-in/restore
  // (verified: SupabaseClient._handleTokenChanged); set explicitly anyway
  // before joining the private channel.
  unawaited(() async {
    try {
      await client.realtime.setAuth(client.auth.currentSession?.accessToken);
    } catch (e) {
      debugPrint('trackingPingsProvider: setAuth failed: $e');
    }
    channel.subscribe((status, error) {
      if (status == RealtimeSubscribeStatus.channelError && !controller.isClosed) {
        controller.addError(error ?? 'tracking channel error');
      }
    });
  }());

  ref.onDispose(() {
    unawaited(client.removeChannel(channel));
    unawaited(controller.close());
  });
  return controller.stream;
});

/// The most recent known technician position: starts from the session
/// snapshot, then follows live pings.
final latestPingProvider =
    Provider.family<TrackingPing?, String>((ref, appointmentId) {
  final live = ref.watch(trackingPingsProvider(appointmentId)).value;
  if (live != null) return live;
  final snapshot = ref.watch(trackingSessionProvider(appointmentId)).value;
  if (snapshot?.lastLat == null || snapshot?.lastLng == null) return null;
  return TrackingPing(
    lat: snapshot!.lastLat!,
    lng: snapshot.lastLng!,
    heading: snapshot.lastHeading,
    speed: null,
    ts: snapshot.lastPingAt ?? snapshot.startedAt,
  );
});

/// ETA from `GET /api/tracking/eta`, re-polled every 45 s. Yields null when
/// the endpoint is unavailable (401/404/501/503 during concurrent wiring) —
/// the UI simply hides the ETA line.
final trackingEtaProvider =
    StreamProvider.family<int?, String>((ref, appointmentId) {
  final api = ref.watch(apiClientProvider);
  final controller = StreamController<int?>();
  Timer? timer;

  Future<void> poll() async {
    try {
      final body = await api.getTrackingEta(appointmentId);
      final eta = (body['etaSeconds'] as num?)?.toInt();
      if (!controller.isClosed) controller.add(eta);
    } on ApiException catch (e) {
      debugPrint('trackingEtaProvider: eta unavailable (${e.statusCode})');
      if (!controller.isClosed) controller.add(null);
    } catch (e) {
      debugPrint('trackingEtaProvider: eta fetch failed: $e');
      if (!controller.isClosed) controller.add(null);
    }
  }

  unawaited(poll());
  timer = Timer.periodic(const Duration(seconds: 45), (_) {
    unawaited(poll());
  });
  ref.onDispose(() {
    timer?.cancel();
    unawaited(controller.close());
  });
  return controller.stream;
});
