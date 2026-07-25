/// Pure mapping from an appointment's current status to the action buttons
/// the owner sees. Driven entirely by [AppointmentStatus.allowedTransitions]
/// so the UI can never offer a transition the DB trigger would reject.
///
/// Flutter-free on purpose — unit-tested on the Dart VM.
library;

import '../../core/constants.dart';

/// Owner-facing actions, in display order.
enum OwnerAction {
  approve(AppointmentStatus.confirmed, 'APPROVE JOB'),
  onMyWay(AppointmentStatus.enRoute, 'ON MY WAY'),
  arrived(AppointmentStatus.inProgress, 'ARRIVED'),
  complete(AppointmentStatus.completed, 'JOB COMPLETE'),
  noShow(AppointmentStatus.noShow, 'NO-SHOW'),
  cancel(AppointmentStatus.cancelled, 'CANCEL JOB');

  const OwnerAction(this.target, this.label);

  /// The status this action transitions to.
  final AppointmentStatus target;
  final String label;

  /// Primary actions render as the big volt CTA; the rest are secondary.
  bool get isPrimary => switch (this) {
        OwnerAction.approve ||
        OwnerAction.onMyWay ||
        OwnerAction.arrived ||
        OwnerAction.complete =>
          true,
        OwnerAction.noShow || OwnerAction.cancel => false,
      };

  /// Destructive actions get the emergency treatment + confirm dialogs.
  bool get isDestructive =>
      this == OwnerAction.cancel || this == OwnerAction.noShow;
}

/// The actions available from [status], in display order (primary first).
///
/// `completed -> closed` is intentionally excluded: closing happens on the
/// payments side once the final balance settles, not from the job screen.
List<OwnerAction> ownerActionsFor(AppointmentStatus status) {
  final allowed = AppointmentStatus.allowedTransitions[status]!;
  return [
    for (final action in OwnerAction.values)
      if (allowed.contains(action.target)) action,
  ];
}
