/// Dart mirrors of the FROZEN API contracts in `packages/core/src/schemas.ts`.
///
/// Field names and shapes MUST match the Zod schemas exactly — do not edit one
/// without the other. All money values are integer cents.
library;

import '../time.dart';

// ---------------------------------------------------------------------------
// POST /api/payments/deposit
// ---------------------------------------------------------------------------

/// Request body for `POST /api/payments/deposit`.
class DepositRequest {
  const DepositRequest({
    required this.addressId,
    required this.scheduledStart,
    required this.serviceIds,
    required this.description,
    this.promoCode,
    required this.autoChargeConsent,
    required this.termsAccepted,
  });

  final String addressId;

  /// ISO 8601 timestamp (with offset) of the chosen slot start.
  final String scheduledStart;
  final List<String> serviceIds;
  final String description;
  final String? promoCode;

  /// Consent to auto-charge the saved card for the final payment.
  final bool autoChargeConsent;
  final bool termsAccepted;

  Map<String, dynamic> toJson() => {
        'appointment': {
          'addressId': addressId,
          'scheduledStart': scheduledStart,
          'serviceIds': serviceIds,
          'description': description,
          // Emergencies are click-to-call only — online booking is never an
          // emergency (schema: z.literal(false).optional()).
          'isEmergency': false,
          if (promoCode != null && promoCode!.isNotEmpty)
            'promoCode': promoCode,
          'autoChargeConsent': autoChargeConsent,
          'termsAccepted': termsAccepted,
        },
      };
}

/// Response body of `POST /api/payments/deposit`.
class DepositResponse {
  const DepositResponse({
    required this.appointmentId,
    required this.paymentIntentClientSecret,
    required this.depositCents,
    required this.discountCents,
  });

  final String appointmentId;
  final String paymentIntentClientSecret;
  final int depositCents;
  final int discountCents;

  factory DepositResponse.fromJson(Map<String, dynamic> json) =>
      DepositResponse(
        appointmentId: json['appointmentId'] as String,
        paymentIntentClientSecret:
            json['paymentIntentClientSecret'] as String,
        depositCents: (json['depositCents'] as num).toInt(),
        discountCents: (json['discountCents'] as num).toInt(),
      );
}

// ---------------------------------------------------------------------------
// GET /api/slots?date=YYYY-MM-DD
// ---------------------------------------------------------------------------

class Slot {
  const Slot({
    required this.startsAt,
    required this.endsAt,
    required this.available,
  });

  /// ISO 8601 with offset — kept as the raw wire string so it can be echoed
  /// back verbatim as `scheduledStart` in the deposit request.
  final String startsAt;
  final String endsAt;
  final bool available;

  /// Slot times are business (Ohio) wall-clock, never device-local — see
  /// `core/time.dart`.
  DateTime get startsAtLocal => parseBusinessTime(startsAt);
  DateTime get endsAtLocal => parseBusinessTime(endsAt);

  factory Slot.fromJson(Map<String, dynamic> json) => Slot(
        startsAt: json['startsAt'] as String,
        endsAt: json['endsAt'] as String,
        available: json['available'] as bool,
      );

  Map<String, dynamic> toJson() =>
      {'startsAt': startsAt, 'endsAt': endsAt, 'available': available};
}

class SlotsResponse {
  const SlotsResponse({required this.slots});

  final List<Slot> slots;

  factory SlotsResponse.fromJson(Map<String, dynamic> json) => SlotsResponse(
        slots: (json['slots'] as List<dynamic>)
            .map((s) => Slot.fromJson(s as Map<String, dynamic>))
            .toList(),
      );
}

// ---------------------------------------------------------------------------
// POST /api/payments/validate-promo
// ---------------------------------------------------------------------------

class ValidatePromoResponse {
  const ValidatePromoResponse({
    required this.valid,
    this.discountCents,
    this.percentOff,
    required this.code,
  });

  final bool valid;
  final int? discountCents;
  final double? percentOff;
  final String code;

  factory ValidatePromoResponse.fromJson(Map<String, dynamic> json) =>
      ValidatePromoResponse(
        valid: json['valid'] as bool,
        discountCents: (json['discountCents'] as num?)?.toInt(),
        percentOff: (json['percentOff'] as num?)?.toDouble(),
        code: json['code'] as String,
      );

  /// Client-side preview of the discount applied to [baseCents].
  ///
  /// The server remains authoritative — the deposit response echoes the real
  /// `discountCents`.
  int previewDiscountCents(int baseCents) {
    if (!valid) return 0;
    var discount = 0;
    if (discountCents != null) {
      discount = discountCents!;
    } else if (percentOff != null) {
      discount = (baseCents * percentOff! / 100).round();
    }
    return discount.clamp(0, baseCents);
  }
}

// ---------------------------------------------------------------------------
// POST /api/payments/final
// ---------------------------------------------------------------------------

enum FinalPaymentStatus {
  charged('charged'),
  paymentLinkSent('payment_link_sent'),
  requiresAction('requires_action');

  const FinalPaymentStatus(this.wire);
  final String wire;

  static FinalPaymentStatus fromWire(String value) =>
      FinalPaymentStatus.values.firstWhere(
        (s) => s.wire == value,
        orElse: () => throw ArgumentError.value(
            value, 'value', 'Unknown final payment status'),
      );
}

class FinalPaymentResponse {
  const FinalPaymentResponse({
    required this.status,
    this.paymentIntentClientSecret,
  });

  final FinalPaymentStatus status;
  final String? paymentIntentClientSecret;

  factory FinalPaymentResponse.fromJson(Map<String, dynamic> json) =>
      FinalPaymentResponse(
        status: FinalPaymentStatus.fromWire(json['status'] as String),
        paymentIntentClientSecret:
            json['paymentIntentClientSecret'] as String?,
      );
}
