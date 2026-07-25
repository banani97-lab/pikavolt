/// Money formatting helpers. All amounts are integer cents (never floats).
library;

/// Formats integer cents as US dollars, e.g. 7500 -> `$75`, 7550 -> `$75.50`.
String formatCents(int cents) {
  final sign = cents < 0 ? '-' : '';
  final abs = cents.abs();
  final dollars = abs ~/ 100;
  final remainder = abs % 100;
  if (remainder == 0) return '$sign\$$dollars';
  return '$sign\$$dollars.${remainder.toString().padLeft(2, '0')}';
}
