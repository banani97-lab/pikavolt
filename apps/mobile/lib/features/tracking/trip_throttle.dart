/// Pure, unit-testable trip logic: the broadcast ping payload (FROZEN
/// contract with the web consumer), haversine distance, and the throttle
/// state machine (25 m movement / 3 s minimum spacing / 30 s stationary
/// heartbeat / 30 s snapshot cadence / 2 h safety timeout).
///
/// Keep this file free of Flutter and plugin imports so it stays trivially
/// testable on the Dart VM.
library;

import 'dart:math' as math;

/// Contract constants for live tracking. Shared by the owner emitter and the
/// customer consumer.
abstract final class TripLimits {
  /// Emit a ping after moving at least this far.
  static const double minDistanceMeters = 25;

  /// Never emit movement pings closer together than this.
  static const Duration minPingGap = Duration(seconds: 3);

  /// When stationary, re-emit the last position at least this often.
  static const Duration heartbeat = Duration(seconds: 30);

  /// Upsert the `tracking_sessions` snapshot at most this often.
  static const Duration snapshotEvery = Duration(seconds: 30);

  /// Safety timeout: a trip never streams longer than this.
  static const Duration maxTripDuration = Duration(hours: 2);
}

/// One broadcast ping.
///
/// FROZEN CONTRACT — private channel `tracking:{appointment_id}`, event
/// `ping`, payload `{lat, lng, heading (nullable), speed (nullable),
/// ts (ISO8601)}`. A concurrent web workstream consumes this shape verbatim;
/// do not rename keys.
class TrackingPing {
  const TrackingPing({
    required this.lat,
    required this.lng,
    this.heading,
    this.speed,
    required this.ts,
  });

  final double lat;
  final double lng;

  /// Course over ground in degrees, null when unknown.
  final double? heading;

  /// Meters per second, null when unknown.
  final double? speed;
  final DateTime ts;

  Map<String, dynamic> toJson() => {
        'lat': lat,
        'lng': lng,
        'heading': heading,
        'speed': speed,
        'ts': ts.toUtc().toIso8601String(),
      };

  factory TrackingPing.fromJson(Map<String, dynamic> json) => TrackingPing(
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        heading: (json['heading'] as num?)?.toDouble(),
        speed: (json['speed'] as num?)?.toDouble(),
        ts: DateTime.parse(json['ts'] as String),
      );
}

/// Great-circle distance between two coordinates, in meters.
double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
  const earthRadius = 6371000.0;
  final dLat = _radians(lat2 - lat1);
  final dLng = _radians(lng2 - lng1);
  final a = math.pow(math.sin(dLat / 2), 2) +
      math.cos(_radians(lat1)) *
          math.cos(_radians(lat2)) *
          math.pow(math.sin(dLng / 2), 2);
  return earthRadius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

double _radians(double degrees) => degrees * math.pi / 180;

/// Compass label ("N", "NE", ...) for a heading in degrees.
String compassLabel(double heading) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  final normalized = ((heading % 360) + 360) % 360;
  return labels[((normalized + 22.5) ~/ 45) % 8];
}

/// Throttle decision engine. All methods take an explicit `now` so the class
/// is deterministic under test; wall-clock wiring lives in OwnerTripService.
class TripThrottle {
  TripThrottle({required this.startedAt});

  /// When the trip began (drives the 2 h safety timeout).
  final DateTime startedAt;

  DateTime? _lastPingAt;
  double? _lastPingLat;
  double? _lastPingLng;
  DateTime? _lastSnapshotAt;

  DateTime? get lastPingAt => _lastPingAt;

  /// Whether a new position fix warrants a movement ping:
  /// first fix always pings; afterwards requires >= 3 s since the last ping
  /// AND >= 25 m of movement.
  bool shouldPingForMovement({
    required double lat,
    required double lng,
    required DateTime now,
  }) {
    if (_lastPingAt == null) return true;
    if (now.difference(_lastPingAt!) < TripLimits.minPingGap) return false;
    final moved =
        haversineMeters(_lastPingLat!, _lastPingLng!, lat, lng);
    return moved >= TripLimits.minDistanceMeters;
  }

  /// Whether a stationary heartbeat is due (>= 30 s since the last ping of
  /// any kind).
  bool shouldHeartbeat(DateTime now) =>
      _lastPingAt == null ||
      now.difference(_lastPingAt!) >= TripLimits.heartbeat;

  /// Record that a ping (movement or heartbeat) was emitted.
  void recordPing({
    required double lat,
    required double lng,
    required DateTime now,
  }) {
    _lastPingAt = now;
    _lastPingLat = lat;
    _lastPingLng = lng;
  }

  /// Whether the `tracking_sessions` snapshot upsert is due (~30 s cadence).
  bool shouldSnapshot(DateTime now) =>
      _lastSnapshotAt == null ||
      now.difference(_lastSnapshotAt!) >= TripLimits.snapshotEvery;

  void recordSnapshot(DateTime now) => _lastSnapshotAt = now;

  /// Whether the 2 h safety timeout has elapsed.
  bool isExpired(DateTime now) =>
      now.difference(startedAt) >= TripLimits.maxTripDuration;
}
