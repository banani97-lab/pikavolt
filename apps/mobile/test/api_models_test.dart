import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:pikavolt/core/api/api_client.dart';
import 'package:pikavolt/core/models/api_models.dart';

/// Serialization round-trips against the FROZEN contracts in
/// packages/core/src/schemas.ts.
void main() {
  group('DepositRequest', () {
    test('serializes to the exact frozen wire shape', () {
      const request = DepositRequest(
        addressId: 'addr_1',
        scheduledStart: '2026-07-20T13:00:00.000-04:00',
        serviceIds: ['svc_1', 'svc_2'],
        description: 'Two dead outlets',
        promoCode: 'VOLT10',
        autoChargeConsent: true,
        termsAccepted: true,
      );

      // Hand-encoded expectation matching DepositRequestSchema exactly.
      final json = request.toJson();
      expect(json.keys, ['appointment']);
      final appointment = json['appointment'] as Map<String, dynamic>;
      expect(appointment['addressId'], 'addr_1');
      expect(appointment['scheduledStart'], '2026-07-20T13:00:00.000-04:00');
      expect(appointment['serviceIds'], ['svc_1', 'svc_2']);
      expect(appointment['description'], 'Two dead outlets');
      expect(appointment['isEmergency'], false);
      expect(appointment['promoCode'], 'VOLT10');
      expect(appointment['autoChargeConsent'], true);
      expect(appointment['termsAccepted'], true);
      expect(
        appointment.keys.toSet(),
        {
          'addressId',
          'scheduledStart',
          'serviceIds',
          'description',
          'isEmergency',
          'promoCode',
          'autoChargeConsent',
          'termsAccepted',
        },
      );
    });

    test('omits promoCode when null (schema: optional)', () {
      const request = DepositRequest(
        addressId: 'addr_1',
        scheduledStart: '2026-07-20T13:00:00.000-04:00',
        serviceIds: ['svc_1'],
        description: '',
        autoChargeConsent: false,
        termsAccepted: true,
      );
      final appointment =
          request.toJson()['appointment'] as Map<String, dynamic>;
      expect(appointment.containsKey('promoCode'), isFalse);
    });

    test('survives jsonEncode/jsonDecode round trip', () {
      const request = DepositRequest(
        addressId: 'a',
        scheduledStart: '2026-01-01T08:00:00.000Z',
        serviceIds: ['s'],
        description: 'd',
        autoChargeConsent: true,
        termsAccepted: true,
      );
      final decoded =
          jsonDecode(jsonEncode(request.toJson())) as Map<String, dynamic>;
      expect(decoded['appointment']['autoChargeConsent'], true);
      expect(decoded['appointment']['isEmergency'], false);
    });
  });

  group('DepositResponse', () {
    test('parses the frozen response shape (money = integer cents)', () {
      final response = DepositResponse.fromJson({
        'appointmentId': 'appt_9',
        'paymentIntentClientSecret': 'pi_123_secret_456',
        'depositCents': 7500,
        'discountCents': 750,
      });
      expect(response.appointmentId, 'appt_9');
      expect(response.paymentIntentClientSecret, 'pi_123_secret_456');
      expect(response.depositCents, 7500);
      expect(response.discountCents, 750);
    });
  });

  group('SlotsResponse', () {
    test('parses slots and keeps raw ISO strings for echo-back', () {
      final response = SlotsResponse.fromJson({
        'slots': [
          {
            'startsAt': '2026-07-20T08:00:00.000-04:00',
            'endsAt': '2026-07-20T10:00:00.000-04:00',
            'available': true,
          },
          {
            'startsAt': '2026-07-20T10:00:00.000-04:00',
            'endsAt': '2026-07-20T12:00:00.000-04:00',
            'available': false,
          },
        ],
      });
      expect(response.slots, hasLength(2));
      expect(response.slots.first.startsAt, '2026-07-20T08:00:00.000-04:00');
      expect(response.slots.first.available, isTrue);
      expect(response.slots.last.available, isFalse);
      // Round trip preserves the wire string verbatim.
      expect(
        response.slots.first.toJson()['startsAt'],
        '2026-07-20T08:00:00.000-04:00',
      );
    });
  });

  group('ValidatePromoResponse', () {
    test('parses fixed-amount promos and previews discount', () {
      final response = ValidatePromoResponse.fromJson({
        'valid': true,
        'discountCents': 1000,
        'code': 'SAVE10',
      });
      expect(response.valid, isTrue);
      expect(response.previewDiscountCents(7500), 1000);
    });

    test('parses percent promos and rounds preview', () {
      final response = ValidatePromoResponse.fromJson({
        'valid': true,
        'percentOff': 15,
        'code': 'PCT15',
      });
      expect(response.previewDiscountCents(7500), 1125);
    });

    test('invalid promo previews zero and clamps to base', () {
      final invalid = ValidatePromoResponse.fromJson({
        'valid': false,
        'code': 'NOPE',
      });
      expect(invalid.previewDiscountCents(7500), 0);

      final huge = ValidatePromoResponse.fromJson({
        'valid': true,
        'discountCents': 999999,
        'code': 'FREE',
      });
      expect(huge.previewDiscountCents(7500), 7500);
    });
  });

  group('FinalPaymentResponse', () {
    test('parses all status values', () {
      for (final wire in ['charged', 'payment_link_sent', 'requires_action']) {
        final response = FinalPaymentResponse.fromJson({'status': wire});
        expect(response.status.wire, wire);
      }
      final withSecret = FinalPaymentResponse.fromJson({
        'status': 'requires_action',
        'paymentIntentClientSecret': 'pi_secret',
      });
      expect(withSecret.status, FinalPaymentStatus.requiresAction);
      expect(withSecret.paymentIntentClientSecret, 'pi_secret');
    });

    test('throws on unknown status', () {
      expect(
        () => FinalPaymentResponse.fromJson({'status': 'nope'}),
        throwsArgumentError,
      );
    });
  });

  group('ApiClient', () {
    ApiClient clientWith(MockClient mock, {String? token}) => ApiClient(
          baseUrl: 'http://api.test',
          accessToken: () => token,
          httpClient: mock,
        );

    test('GET /api/slots sends date query + bearer token', () async {
      late http.Request captured;
      final mock = MockClient((request) async {
        captured = request;
        return http.Response(jsonEncode({'slots': []}), 200);
      });
      await clientWith(mock, token: 'jwt-123').getSlots('2026-07-20');
      expect(captured.method, 'GET');
      expect(captured.url.path, '/api/slots');
      expect(captured.url.queryParameters['date'], '2026-07-20');
      expect(captured.headers['Authorization'], 'Bearer jwt-123');
    });

    test('POST /api/payments/deposit posts the frozen body', () async {
      late http.Request captured;
      final mock = MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({
            'appointmentId': 'a1',
            'paymentIntentClientSecret': 's',
            'depositCents': 7500,
            'discountCents': 0,
          }),
          200,
        );
      });
      const request = DepositRequest(
        addressId: 'addr',
        scheduledStart: '2026-07-20T08:00:00.000-04:00',
        serviceIds: ['svc'],
        description: '',
        autoChargeConsent: false,
        termsAccepted: true,
      );
      final response =
          await clientWith(mock, token: 't').createDeposit(request);
      expect(captured.url.path, '/api/payments/deposit');
      final body = jsonDecode(captured.body) as Map<String, dynamic>;
      expect(body['appointment']['addressId'], 'addr');
      expect(body['appointment']['termsAccepted'], true);
      expect(response.appointmentId, 'a1');
    });

    test('non-2xx surfaces ApiException with 501 flagged as pending',
        () async {
      final mock = MockClient(
        (request) async =>
            http.Response(jsonEncode({'error': 'not implemented'}), 501),
      );
      try {
        await clientWith(mock).getSlots('2026-07-20');
        fail('expected ApiException');
      } on ApiException catch (e) {
        expect(e.statusCode, 501);
        expect(e.isNotImplemented, isTrue);
        expect(e.message, 'not implemented');
      }
    });
  });
}
