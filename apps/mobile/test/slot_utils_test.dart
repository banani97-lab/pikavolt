import 'package:flutter_test/flutter_test.dart';
import 'package:pikavolt/features/booking/slot_utils.dart';

void main() {
  group('formatDateParam', () {
    test('zero-pads month and day (API contract: YYYY-MM-DD)', () {
      expect(formatDateParam(DateTime(2026, 7, 3)), '2026-07-03');
      expect(formatDateParam(DateTime(2026, 11, 25)), '2026-11-25');
      expect(formatDateParam(DateTime(2026, 1, 1)), '2026-01-01');
    });
  });

  group('upcomingDays', () {
    test('starts today at midnight and never offers past days', () {
      final from = DateTime(2026, 7, 13, 17, 45);
      final days = upcomingDays(from, count: 5);
      expect(days, hasLength(5));
      expect(days.first, DateTime(2026, 7, 13));
      expect(days.last, DateTime(2026, 7, 17));
      for (final day in days) {
        expect(day.isBefore(DateTime(2026, 7, 13)), isFalse);
        expect(day.hour, 0);
      }
    });

    test('rolls over month boundaries', () {
      final days = upcomingDays(DateTime(2026, 7, 30), count: 4);
      expect(days[2], DateTime(2026, 8, 1));
    });
  });

  group('isSameDay / dateOnly', () {
    test('compares calendar days ignoring time', () {
      expect(
        isSameDay(DateTime(2026, 7, 13, 8), DateTime(2026, 7, 13, 22)),
        isTrue,
      );
      expect(
        isSameDay(DateTime(2026, 7, 13, 23), DateTime(2026, 7, 14)),
        isFalse,
      );
      expect(dateOnly(DateTime(2026, 7, 13, 23, 59)), DateTime(2026, 7, 13));
    });
  });

  group('labels', () {
    test('weekday/month labels', () {
      expect(weekdayShort(DateTime(2026, 7, 13)), 'Mon');
      expect(weekdayShort(DateTime(2026, 7, 19)), 'Sun');
      expect(monthShort(DateTime(2026, 1, 1)), 'Jan');
      expect(monthShort(DateTime(2026, 12, 1)), 'Dec');
    });

    test('timeLabel uses a 12-hour clock', () {
      expect(timeLabel(DateTime(2026, 7, 13, 0, 0)), '12:00 AM');
      expect(timeLabel(DateTime(2026, 7, 13, 8, 30)), '8:30 AM');
      expect(timeLabel(DateTime(2026, 7, 13, 12, 0)), '12:00 PM');
      expect(timeLabel(DateTime(2026, 7, 13, 17, 5)), '5:05 PM');
    });
  });
}
