import 'package:flutter_test/flutter_test.dart';
import 'package:pikavolt/features/tracking/trip_throttle.dart';

void main() {
  final start = DateTime.utc(2026, 7, 18, 12);

  group('TrackingPing serialization (FROZEN contract)', () {
    test('toJson has exactly {lat,lng,heading,speed,ts} with ISO8601 ts', () {
      final ping = TrackingPing(
        lat: 40.0992,
        lng: -83.1141,
        heading: 271.5,
        speed: 12.3,
        ts: DateTime.utc(2026, 7, 18, 12, 30, 15),
      );
      final json = ping.toJson();
      expect(json.keys.toSet(), {'lat', 'lng', 'heading', 'speed', 'ts'});
      expect(json['lat'], 40.0992);
      expect(json['lng'], -83.1141);
      expect(json['heading'], 271.5);
      expect(json['speed'], 12.3);
      expect(json['ts'], '2026-07-18T12:30:15.000Z');
    });

    test('nullable heading/speed serialize as null', () {
      final ping = TrackingPing(
        lat: 1,
        lng: 2,
        heading: null,
        speed: null,
        ts: DateTime.utc(2026),
      );
      final json = ping.toJson();
      expect(json['heading'], isNull);
      expect(json['speed'], isNull);
    });

    test('round-trips through fromJson', () {
      final ping = TrackingPing(
        lat: 40.1,
        lng: -83.2,
        heading: 90,
        speed: 5,
        ts: DateTime.utc(2026, 7, 18, 12, 30, 15),
      );
      final back = TrackingPing.fromJson(ping.toJson());
      expect(back.lat, ping.lat);
      expect(back.lng, ping.lng);
      expect(back.heading, ping.heading);
      expect(back.speed, ping.speed);
      expect(back.ts.toUtc(), ping.ts.toUtc());
    });
  });

  group('haversineMeters', () {
    test('zero distance for identical points', () {
      expect(haversineMeters(40, -83, 40, -83), closeTo(0, 0.001));
    });

    test('~111 km per degree of latitude', () {
      final d = haversineMeters(40, -83, 41, -83);
      expect(d, closeTo(111195, 500));
    });

    test('~25 m step is detectable', () {
      // ~0.000225 deg latitude ≈ 25 m.
      final d = haversineMeters(40.0, -83.0, 40.000225, -83.0);
      expect(d, closeTo(25, 2));
    });
  });

  group('TripThrottle movement gate (25 m / 3 s)', () {
    test('first fix always pings', () {
      final t = TripThrottle(startedAt: start);
      expect(
        t.shouldPingForMovement(lat: 40, lng: -83, now: start),
        isTrue,
      );
    });

    test('under 3 s never pings, even after big movement', () {
      final t = TripThrottle(startedAt: start)
        ..recordPing(lat: 40, lng: -83, now: start);
      // 1 km away but only 2 s later.
      expect(
        t.shouldPingForMovement(
          lat: 40.01,
          lng: -83,
          now: start.add(const Duration(seconds: 2)),
        ),
        isFalse,
      );
    });

    test('>= 3 s but < 25 m does not ping', () {
      final t = TripThrottle(startedAt: start)
        ..recordPing(lat: 40, lng: -83, now: start);
      // ~11 m north, 5 s later.
      expect(
        t.shouldPingForMovement(
          lat: 40.0001,
          lng: -83,
          now: start.add(const Duration(seconds: 5)),
        ),
        isFalse,
      );
    });

    test('>= 3 s and >= 25 m pings', () {
      final t = TripThrottle(startedAt: start)
        ..recordPing(lat: 40, lng: -83, now: start);
      expect(
        t.shouldPingForMovement(
          lat: 40.0003, // ~33 m
          lng: -83,
          now: start.add(const Duration(seconds: 5)),
        ),
        isTrue,
      );
    });
  });

  group('TripThrottle heartbeat (30 s stationary)', () {
    test('due immediately before any ping', () {
      final t = TripThrottle(startedAt: start);
      expect(t.shouldHeartbeat(start), isTrue);
    });

    test('not due 29 s after a ping, due at 30 s', () {
      final t = TripThrottle(startedAt: start)
        ..recordPing(lat: 40, lng: -83, now: start);
      expect(
        t.shouldHeartbeat(start.add(const Duration(seconds: 29))),
        isFalse,
      );
      expect(
        t.shouldHeartbeat(start.add(const Duration(seconds: 30))),
        isTrue,
      );
    });
  });

  group('TripThrottle snapshot cadence (30 s)', () {
    test('first snapshot allowed, then throttled for 30 s', () {
      final t = TripThrottle(startedAt: start);
      expect(t.shouldSnapshot(start), isTrue);
      t.recordSnapshot(start);
      expect(
        t.shouldSnapshot(start.add(const Duration(seconds: 20))),
        isFalse,
      );
      expect(
        t.shouldSnapshot(start.add(const Duration(seconds: 30))),
        isTrue,
      );
    });
  });

  group('TripThrottle 2 h auto-stop', () {
    test('not expired before 2 h, expired at/after 2 h', () {
      final t = TripThrottle(startedAt: start);
      expect(
        t.isExpired(start.add(const Duration(hours: 1, minutes: 59))),
        isFalse,
      );
      expect(t.isExpired(start.add(const Duration(hours: 2))), isTrue);
      expect(
        t.isExpired(start.add(const Duration(hours: 2, seconds: 1))),
        isTrue,
      );
    });
  });

  group('compassLabel', () {
    test('cardinal + intercardinal directions', () {
      expect(compassLabel(0), 'N');
      expect(compassLabel(45), 'NE');
      expect(compassLabel(90), 'E');
      expect(compassLabel(180), 'S');
      expect(compassLabel(270), 'W');
      expect(compassLabel(359), 'N');
    });
  });
}
