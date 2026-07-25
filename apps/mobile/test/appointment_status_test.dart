import 'package:flutter_test/flutter_test.dart';
import 'package:pikavolt/core/constants.dart';

void main() {
  group('AppointmentStatus wire mapping', () {
    test('serializes to the exact database values', () {
      expect(AppointmentStatus.requested.wire, 'requested');
      expect(AppointmentStatus.confirmed.wire, 'confirmed');
      expect(AppointmentStatus.enRoute.wire, 'en_route');
      expect(AppointmentStatus.inProgress.wire, 'in_progress');
      expect(AppointmentStatus.completed.wire, 'completed');
      expect(AppointmentStatus.closed.wire, 'closed');
      expect(AppointmentStatus.cancelled.wire, 'cancelled');
      expect(AppointmentStatus.noShow.wire, 'no_show');
    });

    test('round-trips every value through fromWire', () {
      for (final status in AppointmentStatus.values) {
        expect(AppointmentStatus.fromWire(status.wire), status);
      }
    });

    test('rejects unknown wire values', () {
      expect(
        () => AppointmentStatus.fromWire('enRoute'),
        throwsArgumentError,
      );
      expect(() => AppointmentStatus.fromWire(''), throwsArgumentError);
    });
  });

  group('AppointmentStatus transitions', () {
    test('map covers every status', () {
      expect(
        AppointmentStatus.allowedTransitions.keys.toSet(),
        AppointmentStatus.values.toSet(),
      );
    });

    test('matches the server-side state machine exactly', () {
      expect(
        AppointmentStatus.allowedTransitions[AppointmentStatus.requested],
        [AppointmentStatus.confirmed, AppointmentStatus.cancelled],
      );
      expect(
        AppointmentStatus.allowedTransitions[AppointmentStatus.confirmed],
        [AppointmentStatus.enRoute, AppointmentStatus.cancelled],
      );
      expect(
        AppointmentStatus.allowedTransitions[AppointmentStatus.enRoute],
        [
          AppointmentStatus.inProgress,
          AppointmentStatus.cancelled,
          AppointmentStatus.noShow,
        ],
      );
      expect(
        AppointmentStatus.allowedTransitions[AppointmentStatus.inProgress],
        [
          AppointmentStatus.completed,
          AppointmentStatus.noShow,
          AppointmentStatus.cancelled,
        ],
      );
      expect(
        AppointmentStatus.allowedTransitions[AppointmentStatus.completed],
        [AppointmentStatus.closed],
      );
    });

    test('closed, cancelled, and no_show are terminal', () {
      expect(AppointmentStatus.closed.isTerminal, isTrue);
      expect(AppointmentStatus.cancelled.isTerminal, isTrue);
      expect(AppointmentStatus.noShow.isTerminal, isTrue);
      expect(AppointmentStatus.requested.isTerminal, isFalse);
    });

    test('canTransitionTo agrees with the map', () {
      expect(
        AppointmentStatus.requested.canTransitionTo(
          AppointmentStatus.confirmed,
        ),
        isTrue,
      );
      expect(
        AppointmentStatus.requested.canTransitionTo(AppointmentStatus.enRoute),
        isFalse,
      );
      expect(
        AppointmentStatus.completed.canTransitionTo(AppointmentStatus.closed),
        isTrue,
      );
      expect(
        AppointmentStatus.closed.canTransitionTo(AppointmentStatus.requested),
        isFalse,
      );
    });
  });
}
