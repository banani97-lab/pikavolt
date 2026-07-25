/// Shared domain constants for the Pikavolt app.
///
/// [AppointmentStatus] mirrors the `appointment_status` enum in the database
/// (`packages/db`). The wire values and allowed transitions MUST stay in sync
/// with the SQL definition — do not edit one without the other.
library;

/// Lifecycle status of an appointment.
enum AppointmentStatus {
  requested('requested'),
  confirmed('confirmed'),
  enRoute('en_route'),
  inProgress('in_progress'),
  completed('completed'),
  closed('closed'),
  cancelled('cancelled'),
  noShow('no_show');

  const AppointmentStatus(this.wire);

  /// The exact string stored in the database / sent over the API.
  final String wire;

  /// Parses a database/API value into an [AppointmentStatus].
  ///
  /// Throws [ArgumentError] for unknown values.
  static AppointmentStatus fromWire(String value) {
    for (final status in AppointmentStatus.values) {
      if (status.wire == value) return status;
    }
    throw ArgumentError.value(value, 'value', 'Unknown appointment status');
  }

  /// Allowed status transitions, identical to the server-side state machine:
  ///
  /// - requested   -> confirmed, cancelled
  /// - confirmed   -> en_route, cancelled
  /// - en_route    -> in_progress, cancelled, no_show
  /// - in_progress -> completed, no_show, cancelled
  /// - completed   -> closed
  /// - closed / cancelled / no_show are terminal.
  static const Map<AppointmentStatus, List<AppointmentStatus>>
      allowedTransitions = {
    AppointmentStatus.requested: [
      AppointmentStatus.confirmed,
      AppointmentStatus.cancelled,
    ],
    AppointmentStatus.confirmed: [
      AppointmentStatus.enRoute,
      AppointmentStatus.cancelled,
    ],
    AppointmentStatus.enRoute: [
      AppointmentStatus.inProgress,
      AppointmentStatus.cancelled,
      AppointmentStatus.noShow,
    ],
    AppointmentStatus.inProgress: [
      AppointmentStatus.completed,
      AppointmentStatus.noShow,
      AppointmentStatus.cancelled,
    ],
    AppointmentStatus.completed: [
      AppointmentStatus.closed,
    ],
    AppointmentStatus.closed: [],
    AppointmentStatus.cancelled: [],
    AppointmentStatus.noShow: [],
  };

  /// Whether this status may transition to [next].
  bool canTransitionTo(AppointmentStatus next) =>
      allowedTransitions[this]!.contains(next);

  /// Whether no further transitions are possible.
  bool get isTerminal => allowedTransitions[this]!.isEmpty;

  /// Human-friendly label for UI display.
  String get label => switch (this) {
        AppointmentStatus.requested => 'Requested',
        AppointmentStatus.confirmed => 'Confirmed',
        AppointmentStatus.enRoute => 'En route',
        AppointmentStatus.inProgress => 'In progress',
        AppointmentStatus.completed => 'Completed',
        AppointmentStatus.closed => 'Closed',
        AppointmentStatus.cancelled => 'Cancelled',
        AppointmentStatus.noShow => 'No show',
      };
}

/// User roles as stored in `profiles.role`.
enum UserRole {
  customer('customer'),
  owner('owner');

  const UserRole(this.wire);
  final String wire;

  static UserRole fromWire(String? value) => switch (value) {
        'owner' => UserRole.owner,
        _ => UserRole.customer,
      };
}

/// Business constants (see docs/owner-content.md).
abstract final class BusinessInfo {
  static const String legalName = 'Pikavolt LLC';
  static const String primaryTagline =
      'Powering Ohio with Quality You Can Trust.';

  /// Service call fee in cents ($150). 50% is due at booking.
  static const int serviceCallFeeCents = 15000;

  /// Booking deposit in cents ($75 = 50% of the service call fee).
  static const int bookingDepositCents = 7500;
}
