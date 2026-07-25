import 'package:flutter_test/flutter_test.dart';
import 'package:pikavolt/core/models/db_models.dart';
import 'package:pikavolt/core/time.dart';

/// Appointment and slot times must always render in Ohio time, never the
/// device's timezone. Regression guard for the bug where `.toLocal()` made a
/// 08:00 ET job show as 05:00 on a Pacific device and surfaced 5:00 AM slots
/// outside the 8-5 business hours.
void main() {
  setUpAll(initBusinessTime);

  test('converts UTC to Eastern wall-clock (EDT, summer)', () {
    // 12:00Z on 2026-07-20 == 08:00 EDT (UTC-4).
    final t = parseBusinessTime('2026-07-20T12:00:00Z');
    expect(t.hour, 8);
    expect(t.minute, 0);
    expect(t.day, 20);
  });

  test('handles EST (winter) — offset shifts to UTC-5', () {
    // 13:00Z on 2026-01-15 == 08:00 EST.
    final t = parseBusinessTime('2026-01-15T13:00:00Z');
    expect(t.hour, 8);
  });

  test('is independent of the device timezone', () {
    // Same instant expressed two ways must land on the same Ohio wall clock.
    final fromZulu = parseBusinessTime('2026-07-20T12:00:00Z');
    final fromOffset = parseBusinessTime('2026-07-20T05:00:00-07:00');
    expect(fromOffset.hour, fromZulu.hour);
    expect(fromZulu.hour, 8);
  });

  test('Appointment.fromJson renders business time', () {
    final a = Appointment.fromJson({
      'id': 'a1',
      'customer_id': 'c1',
      'address_id': 'ad1',
      'status': 'confirmed',
      'scheduled_start': '2026-07-20T14:30:00Z', // 10:30 EDT
      'scheduled_end': '2026-07-20T16:30:00Z', // 12:30 EDT
    });
    expect(a.scheduledStart.hour, 10);
    expect(a.scheduledStart.minute, 30);
    expect(a.scheduledEnd.hour, 12);
  });

  test('a job at the 08:00 open renders inside business hours', () {
    // The booking calendar must never offer times outside 8-17 local.
    final open = parseBusinessTime('2026-07-21T12:00:00Z');
    expect(open.hour, greaterThanOrEqualTo(8));
    expect(open.hour, lessThan(17));
  });
}
