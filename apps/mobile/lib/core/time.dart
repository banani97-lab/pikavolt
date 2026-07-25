/// Pikavolt operates in Central Ohio, so every appointment and slot time means
/// *Ohio* time — never the device's timezone.
///
/// Using `DateTime.toLocal()` for these silently produced wrong times for any
/// device not set to Eastern: a job stored at 12:00Z (08:00 ET) rendered as
/// 05:00 on a Pacific device, and the booking calendar offered "5:00 AM" slots
/// that fall outside the 8-5 business hours. Caught on a simulator whose host
/// was PDT, where mobile disagreed with the web admin by three hours for the
/// same appointment.
///
/// Handles EDT/EST automatically, so it stays correct across DST.
library;

import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

const String businessTimeZone = 'America/New_York';

tz.Location? _ohio;

/// Loads the timezone database. Safe to call more than once; must run before
/// the first [toBusinessTime] call (wired in `main()`).
void initBusinessTime() {
  if (_ohio != null) return;
  tzdata.initializeTimeZones();
  _ohio = tz.getLocation(businessTimeZone);
}

/// Converts an instant to Ohio wall-clock time.
///
/// The result is a [DateTime] subclass, so existing `DateFormat` calls format
/// it in business time with no further changes. Falls back to the device zone
/// only if [initBusinessTime] was somehow skipped, so callers never crash.
DateTime toBusinessTime(DateTime instant) {
  final location = _ohio;
  if (location == null) return instant.toLocal();
  return tz.TZDateTime.from(instant, location);
}

/// Parses an ISO-8601 timestamp straight into Ohio wall-clock time.
DateTime parseBusinessTime(String iso) => toBusinessTime(DateTime.parse(iso));
