/// Dart models for rows read directly from Supabase (snake_case wire names —
/// see `packages/db/supabase/migrations/0001_init.sql`). Money is integer
/// cents throughout.
library;

import '../constants.dart';
import '../time.dart';

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

class ServiceCategory {
  const ServiceCategory({
    required this.id,
    required this.slug,
    required this.name,
    this.description,
    this.icon,
    this.sortOrder = 0,
  });

  final String id;
  final String slug;
  final String name;
  final String? description;
  final String? icon;
  final int sortOrder;

  factory ServiceCategory.fromJson(Map<String, dynamic> json) =>
      ServiceCategory(
        id: json['id'] as String,
        slug: json['slug'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        icon: json['icon'] as String?,
        sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
      );
}

class ServiceItem {
  const ServiceItem({
    required this.id,
    this.categoryId,
    required this.name,
    this.description,
    this.sortOrder = 0,
  });

  final String id;
  final String? categoryId;
  final String name;
  final String? description;
  final int sortOrder;

  factory ServiceItem.fromJson(Map<String, dynamic> json) => ServiceItem(
        id: json['id'] as String,
        categoryId: json['category_id'] as String?,
        name: json['name'] as String,
        description: json['description'] as String?,
        sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
      );
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

class Address {
  const Address({
    required this.id,
    required this.userId,
    this.label,
    required this.line1,
    this.line2,
    required this.city,
    required this.state,
    required this.zip,
    this.propertyType = 'residential',
    this.isDefault = false,
    this.lat,
    this.lng,
  });

  final String id;
  final String userId;
  final String? label;
  final String line1;
  final String? line2;
  final String city;
  final String state;
  final String zip;
  final String propertyType;
  final bool isDefault;

  /// Geocoded coordinates (nullable in the schema). Used by the tracking
  /// screens for the destination pin. (Additive edit by WS-G.)
  final double? lat;
  final double? lng;

  String get oneLine =>
      '$line1${line2 == null || line2!.isEmpty ? '' : ', $line2'}, '
      '$city, $state $zip';

  factory Address.fromJson(Map<String, dynamic> json) => Address(
        id: json['id'] as String,
        userId: json['user_id'] as String,
        label: json['label'] as String?,
        line1: json['line1'] as String,
        line2: json['line2'] as String?,
        city: json['city'] as String,
        state: json['state'] as String,
        zip: json['zip'] as String,
        propertyType: json['property_type'] as String? ?? 'residential',
        isDefault: json['is_default'] as bool? ?? false,
        lat: (json['lat'] as num?)?.toDouble(),
        lng: (json['lng'] as num?)?.toDouble(),
      );
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

class Appointment {
  const Appointment({
    required this.id,
    required this.customerId,
    this.addressId,
    required this.status,
    this.isEmergency = false,
    required this.scheduledStart,
    required this.scheduledEnd,
    this.description,
    this.jobNotes,
    this.serviceCallFeeCents = 15000,
    this.jobTotalCents,
    this.promoCode,
    this.discountCents = 0,
    this.autoChargeConsent = false,
    this.cancelledReason,
  });

  final String id;
  final String customerId;

  /// Null for ad-hoc invoices, which have no service address.
  final String? addressId;
  final AppointmentStatus status;
  final bool isEmergency;
  final DateTime scheduledStart;
  final DateTime scheduledEnd;
  final String? description;

  /// Owner's notes about the job (materials, findings). (Additive: WS-G.)
  final String? jobNotes;
  final int serviceCallFeeCents;
  final int? jobTotalCents;
  final String? promoCode;
  final int discountCents;
  final bool autoChargeConsent;
  final String? cancelledReason;

  String get jobNotesOrEmpty => jobNotes ?? '';

  bool get isUpcoming =>
      !status.isTerminal && status != AppointmentStatus.completed;

  /// Cancellation with a full deposit refund requires >= 24h notice.
  bool refundEligibleAt(DateTime now) =>
      scheduledStart.difference(now) >= const Duration(hours: 24);

  bool get canCancel =>
      status == AppointmentStatus.requested ||
      status == AppointmentStatus.confirmed;

  factory Appointment.fromJson(Map<String, dynamic> json) => Appointment(
        id: json['id'] as String,
        customerId: json['customer_id'] as String,
        addressId: json['address_id'] as String?,
        status: AppointmentStatus.fromWire(json['status'] as String),
        isEmergency: json['is_emergency'] as bool? ?? false,
        // Appointment times are business (Ohio) wall-clock — see core/time.dart.
        scheduledStart: parseBusinessTime(json['scheduled_start'] as String),
        scheduledEnd: parseBusinessTime(json['scheduled_end'] as String),
        description: json['description'] as String?,
        jobNotes: json['job_notes'] as String?,
        serviceCallFeeCents:
            (json['service_call_fee_cents'] as num?)?.toInt() ?? 15000,
        jobTotalCents: (json['job_total_cents'] as num?)?.toInt(),
        promoCode: json['promo_code'] as String?,
        discountCents: (json['discount_cents'] as num?)?.toInt() ?? 0,
        autoChargeConsent: json['auto_charge_consent'] as bool? ?? false,
        cancelledReason: json['cancelled_reason'] as String?,
      );
}

class AppointmentEvent {
  const AppointmentEvent({
    required this.id,
    required this.appointmentId,
    this.fromStatus,
    this.toStatus,
    required this.createdAt,
  });

  final String id;
  final String appointmentId;
  final AppointmentStatus? fromStatus;
  final AppointmentStatus? toStatus;
  final DateTime createdAt;

  factory AppointmentEvent.fromJson(Map<String, dynamic> json) =>
      AppointmentEvent(
        id: json['id'] as String,
        appointmentId: json['appointment_id'] as String,
        fromStatus: json['from_status'] == null
            ? null
            : AppointmentStatus.fromWire(json['from_status'] as String),
        toStatus: json['to_status'] == null
            ? null
            : AppointmentStatus.fromWire(json['to_status'] as String),
        createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
      );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

class PaymentRow {
  const PaymentRow({
    required this.id,
    required this.appointmentId,
    this.kind,
    required this.amountCents,
    required this.status,
    this.stripePaymentIntentId,
    this.discountCents = 0,
    this.paidAt,
  });

  final String id;
  final String appointmentId;

  /// 'deposit' | 'final' | 'extra'
  final String? kind;
  final int amountCents;

  /// 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
  final String status;
  final String? stripePaymentIntentId;
  final int discountCents;
  final DateTime? paidAt;

  bool get isPending => status == 'pending';
  bool get isSucceeded => status == 'succeeded';

  factory PaymentRow.fromJson(Map<String, dynamic> json) => PaymentRow(
        id: json['id'] as String,
        appointmentId: json['appointment_id'] as String,
        kind: json['kind'] as String?,
        amountCents: (json['amount_cents'] as num).toInt(),
        status: json['status'] as String? ?? 'pending',
        stripePaymentIntentId: json['stripe_payment_intent_id'] as String?,
        discountCents: (json['discount_cents'] as num?)?.toInt() ?? 0,
        paidAt: json['paid_at'] == null
            ? null
            : DateTime.parse(json['paid_at'] as String).toLocal(),
      );
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

class Conversation {
  const Conversation({
    required this.id,
    required this.customerId,
    required this.status,
    this.customerUnread = 0,
  });

  final String id;
  final String customerId;
  final String status;
  final int customerUnread;

  factory Conversation.fromJson(Map<String, dynamic> json) => Conversation(
        id: json['id'] as String,
        customerId: json['customer_id'] as String,
        status: json['status'] as String? ?? 'open',
        customerUnread: (json['customer_unread'] as num?)?.toInt() ?? 0,
      );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.conversationId,
    this.senderId,
    required this.senderRole,
    required this.body,
    this.readAt,
    required this.createdAt,
  });

  final String id;
  final String conversationId;
  final String? senderId;

  /// 'customer' | 'owner'
  final String senderRole;
  final String body;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get fromCustomer => senderRole == 'customer';

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String,
        conversationId: json['conversation_id'] as String,
        senderId: json['sender_id'] as String?,
        senderRole: json['sender_role'] as String,
        body: json['body'] as String,
        readAt: json['read_at'] == null
            ? null
            : DateTime.parse(json['read_at'] as String).toLocal(),
        createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
      );
}
