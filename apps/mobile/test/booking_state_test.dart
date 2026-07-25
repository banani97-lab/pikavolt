import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:pikavolt/core/models/api_models.dart';
import 'package:pikavolt/features/booking/booking_state.dart';

void main() {
  late ProviderContainer container;
  late BookingController controller;

  BookingState state() => container.read(bookingControllerProvider);

  setUp(() {
    container = ProviderContainer();
    controller = container.read(bookingControllerProvider.notifier);
  });

  tearDown(() => container.dispose());

  const slot = Slot(
    startsAt: '2026-07-20T13:00:00.000-04:00',
    endsAt: '2026-07-20T15:00:00.000-04:00',
    available: true,
  );

  group('step navigation guards', () {
    test('cannot leave services step with no services selected', () {
      expect(state().canProceed, isFalse);
      controller.nextStep();
      expect(state().step, BookingStep.services);
    });

    test('walks the full happy path in order', () {
      controller.toggleService('svc_1');
      controller.nextStep();
      expect(state().step, BookingStep.details);

      // Description optional.
      controller.nextStep();
      expect(state().step, BookingStep.address);

      // Address required.
      controller.nextStep();
      expect(state().step, BookingStep.address);
      controller.selectAddress('addr_1');
      controller.nextStep();
      expect(state().step, BookingStep.schedule);

      // Slot required.
      controller.nextStep();
      expect(state().step, BookingStep.schedule);
      controller.selectDate(DateTime(2026, 7, 20));
      controller.selectSlot(slot);
      controller.nextStep();
      expect(state().step, BookingStep.review);

      // Terms required to be able to pay.
      expect(state().canProceed, isFalse);
      controller.setTermsAccepted(true);
      expect(state().canProceed, isTrue);
    });

    test('previousStep walks backwards and stops at the first step', () {
      controller.toggleService('svc_1');
      controller.nextStep();
      controller.previousStep();
      expect(state().step, BookingStep.services);
      controller.previousStep();
      expect(state().step, BookingStep.services);
    });
  });

  group('service selection', () {
    test('toggleService adds and removes', () {
      controller.toggleService('a');
      controller.toggleService('b');
      expect(state().serviceIds, {'a', 'b'});
      controller.toggleService('a');
      expect(state().serviceIds, {'b'});
    });
  });

  group('schedule', () {
    test('changing the date clears the picked slot', () {
      controller.selectDate(DateTime(2026, 7, 20));
      controller.selectSlot(slot);
      expect(state().selectedSlot, isNotNull);
      controller.selectDate(DateTime(2026, 7, 21));
      expect(state().selectedSlot, isNull);
    });

    test('booked slots cannot be selected', () {
      const booked = Slot(
        startsAt: '2026-07-20T08:00:00.000-04:00',
        endsAt: '2026-07-20T10:00:00.000-04:00',
        available: false,
      );
      controller.selectSlot(booked);
      expect(state().selectedSlot, isNull);
    });
  });

  group('promo + deposit preview', () {
    test('deposit preview is \$75 with no promo', () {
      expect(state().depositPreviewCents, 7500);
    });

    test('valid promo reduces the preview; invalid is ignored', () {
      controller.applyPromo(const ValidatePromoResponse(
        valid: true,
        discountCents: 1500,
        code: 'SAVE15',
      ));
      expect(state().depositPreviewCents, 6000);

      controller.clearPromo();
      expect(state().depositPreviewCents, 7500);

      controller.applyPromo(const ValidatePromoResponse(
        valid: false,
        code: 'BAD',
      ));
      expect(state().promo, isNull);
      expect(state().depositPreviewCents, 7500);
    });
  });

  group('buildDepositRequest', () {
    test('throws until required selections exist', () {
      expect(() => state().buildDepositRequest(), throwsStateError);
    });

    test('builds the exact request from wizard state', () {
      controller.toggleService('svc_1');
      controller.selectAddress('addr_1');
      controller.selectDate(DateTime(2026, 7, 20));
      controller.selectSlot(slot);
      controller.setDescription('Panel upgrade');
      controller.setAutoChargeConsent(true);
      controller.setTermsAccepted(true);
      controller.applyPromo(const ValidatePromoResponse(
        valid: true,
        percentOff: 10,
        code: 'PCT10',
      ));

      final json =
          state().buildDepositRequest().toJson()['appointment']
              as Map<String, dynamic>;
      expect(json['addressId'], 'addr_1');
      // scheduledStart echoes the slot's wire string verbatim.
      expect(json['scheduledStart'], slot.startsAt);
      expect(json['serviceIds'], ['svc_1']);
      expect(json['description'], 'Panel upgrade');
      expect(json['promoCode'], 'PCT10');
      expect(json['autoChargeConsent'], true);
      expect(json['termsAccepted'], true);
      expect(json['isEmergency'], false);
    });
  });

  test('markCompleted stores the response and reset clears everything', () {
    controller.toggleService('svc_1');
    controller.markCompleted(const DepositResponse(
      appointmentId: 'appt',
      paymentIntentClientSecret: 's',
      depositCents: 7500,
      discountCents: 0,
    ));
    expect(state().completed?.appointmentId, 'appt');
    expect(state().submitting, isFalse);

    controller.reset();
    expect(state().completed, isNull);
    expect(state().serviceIds, isEmpty);
    expect(state().step, BookingStep.services);
  });
}
