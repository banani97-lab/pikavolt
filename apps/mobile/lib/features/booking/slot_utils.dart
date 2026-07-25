/// Pure date helpers for the slot picker (unit-tested — keep free of Flutter
/// imports).
library;

/// Formats a date as the API's `?date=YYYY-MM-DD` query value.
String formatDateParam(DateTime date) {
  final m = date.month.toString().padLeft(2, '0');
  final d = date.day.toString().padLeft(2, '0');
  return '${date.year}-$m-$d';
}

/// Midnight-truncated copy of [date].
DateTime dateOnly(DateTime date) => DateTime(date.year, date.month, date.day);

bool isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// The horizontally scrolling day strip: [count] consecutive days starting
/// today ([from]). Past days are never offered.
List<DateTime> upcomingDays(DateTime from, {int count = 30}) {
  final start = dateOnly(from);
  return List.generate(count, (i) => start.add(Duration(days: i)));
}

/// Short weekday label, Mon..Sun.
String weekdayShort(DateTime date) => const [
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ][date.weekday - 1];

/// Short month label, Jan..Dec.
String monthShort(DateTime date) => const [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ][date.month - 1];

/// 12-hour clock label for a slot time, e.g. "8:00 AM".
String timeLabel(DateTime local) {
  final hour12 = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minutes = local.minute.toString().padLeft(2, '0');
  final suffix = local.hour < 12 ? 'AM' : 'PM';
  return '$hour12:$minutes $suffix';
}
