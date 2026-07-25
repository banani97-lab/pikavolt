import 'package:flutter_test/flutter_test.dart';
import 'package:pikavolt/core/constants.dart';
import 'package:pikavolt/core/models/db_models.dart';
import 'package:pikavolt/core/money.dart';
import 'package:pikavolt/features/notifications/fcm_service.dart';

void main() {
  group('formatCents', () {
    test('formats whole dollars without decimals', () {
      expect(formatCents(7500), '\$75');
      expect(formatCents(15000), '\$150');
      expect(formatCents(0), '\$0');
    });

    test('formats fractional dollars with two digits', () {
      expect(formatCents(7550), '\$75.50');
      expect(formatCents(101), '\$1.01');
      expect(formatCents(-7500), '-\$75');
    });
  });

  group('Appointment (db row parsing)', () {
    final json = {
      'id': 'appt-1',
      'customer_id': 'user-1',
      'address_id': 'addr-1',
      'status': 'en_route',
      'is_emergency': false,
      'scheduled_start': '2026-07-20T17:00:00+00:00',
      'scheduled_end': '2026-07-20T19:00:00+00:00',
      'description': 'Barn wiring',
      'service_call_fee_cents': 15000,
      'discount_cents': 0,
      'auto_charge_consent': true,
    };

    test('parses wire statuses (en_route/in_progress/no_show)', () {
      expect(Appointment.fromJson(json).status, AppointmentStatus.enRoute);
      expect(
        Appointment.fromJson({...json, 'status': 'in_progress'}).status,
        AppointmentStatus.inProgress,
      );
      expect(
        Appointment.fromJson({...json, 'status': 'no_show'}).status,
        AppointmentStatus.noShow,
      );
    });

    test('24h refund eligibility around the boundary', () {
      final appointment = Appointment.fromJson(json);
      final start = appointment.scheduledStart;
      expect(
        appointment.refundEligibleAt(
          start.subtract(const Duration(hours: 25)),
        ),
        isTrue,
      );
      expect(
        appointment.refundEligibleAt(
          start.subtract(const Duration(hours: 24)),
        ),
        isTrue,
      );
      expect(
        appointment.refundEligibleAt(
          start.subtract(const Duration(hours: 23)),
        ),
        isFalse,
      );
    });

    test('customer can cancel only requested/confirmed', () {
      expect(
        Appointment.fromJson({...json, 'status': 'requested'}).canCancel,
        isTrue,
      );
      expect(
        Appointment.fromJson({...json, 'status': 'confirmed'}).canCancel,
        isTrue,
      );
      expect(Appointment.fromJson(json).canCancel, isFalse); // en_route
      expect(
        Appointment.fromJson({...json, 'status': 'completed'}).canCancel,
        isFalse,
      );
    });
  });

  group('FCM tap routing', () {
    test('routes by data.type', () {
      expect(
        FcmService.routeForMessageData({'type': 'new_message'}),
        '/customer/chat',
      );
      for (final type in [
        'booking_confirmed',
        'tech_en_route',
        'final_payment_due',
      ]) {
        expect(
          FcmService.routeForMessageData(
              {'type': type, 'appointmentId': 'a1'}),
          '/customer/appointments/a1',
        );
      }
    });

    test('falls back to home for unknown or incomplete payloads', () {
      expect(FcmService.routeForMessageData({}), '/customer/home');
      expect(
        FcmService.routeForMessageData({'type': 'booking_confirmed'}),
        '/customer/home',
      );
      expect(
        FcmService.routeForMessageData({'type': 'mystery'}),
        '/customer/home',
      );
    });
  });
}
