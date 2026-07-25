import 'package:flutter_test/flutter_test.dart';
import 'package:pikavolt/core/constants.dart';
import 'package:pikavolt/features/owner/owner_actions.dart';

void main() {
  group('ownerActionsFor — driven by allowedTransitions', () {
    test('requested -> Approve + Cancel', () {
      final actions = ownerActionsFor(AppointmentStatus.requested);
      expect(actions, [OwnerAction.approve, OwnerAction.cancel]);
    });

    test('confirmed -> On My Way + Cancel (no Arrived/Complete yet)', () {
      final actions = ownerActionsFor(AppointmentStatus.confirmed);
      expect(actions.contains(OwnerAction.onMyWay), isTrue);
      expect(actions.contains(OwnerAction.cancel), isTrue);
      expect(actions.contains(OwnerAction.arrived), isFalse);
      expect(actions.contains(OwnerAction.complete), isFalse);
    });

    test('en_route -> Arrived + No-show + Cancel', () {
      final actions = ownerActionsFor(AppointmentStatus.enRoute);
      expect(
        actions.toSet(),
        {OwnerAction.arrived, OwnerAction.noShow, OwnerAction.cancel},
      );
    });

    test('in_progress -> Job Complete + No-show + Cancel', () {
      final actions = ownerActionsFor(AppointmentStatus.inProgress);
      expect(
        actions.toSet(),
        {OwnerAction.complete, OwnerAction.noShow, OwnerAction.cancel},
      );
    });

    test('terminal statuses expose no actions', () {
      for (final status in [
        AppointmentStatus.completed, // closing happens on the payments side
        AppointmentStatus.closed,
        AppointmentStatus.cancelled,
        AppointmentStatus.noShow,
      ]) {
        expect(ownerActionsFor(status), isEmpty, reason: status.name);
      }
    });

    test('every surfaced action targets a legal transition', () {
      for (final status in AppointmentStatus.values) {
        final allowed = AppointmentStatus.allowedTransitions[status]!;
        for (final action in ownerActionsFor(status)) {
          expect(
            allowed.contains(action.target),
            isTrue,
            reason: '${status.name} -> ${action.name}',
          );
        }
      }
    });

    test('On My Way / Arrived are primary; Cancel / No-show are secondary', () {
      expect(OwnerAction.onMyWay.isPrimary, isTrue);
      expect(OwnerAction.arrived.isPrimary, isTrue);
      expect(OwnerAction.complete.isPrimary, isTrue);
      expect(OwnerAction.cancel.isPrimary, isFalse);
      expect(OwnerAction.noShow.isPrimary, isFalse);
      expect(OwnerAction.cancel.isDestructive, isTrue);
      expect(OwnerAction.noShow.isDestructive, isTrue);
    });
  });
}
