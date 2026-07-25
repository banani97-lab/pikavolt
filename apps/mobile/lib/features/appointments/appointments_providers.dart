import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/constants.dart';
import '../../core/models/db_models.dart';
import '../../core/supabase_provider.dart';

/// Live stream of the signed-in customer's appointments (realtime via
/// Supabase `.stream`, ordered soonest-first).
final myAppointmentsProvider = StreamProvider<List<Appointment>>((ref) {
  final user = ref.watch(currentUserProvider);
  if (user == null) return Stream.value(const []);
  final client = ref.watch(supabaseClientProvider);
  return client
      .from('appointments')
      .stream(primaryKey: ['id'])
      .eq('customer_id', user.id)
      .order('scheduled_start', ascending: true)
      .map((rows) => rows.map(Appointment.fromJson).toList());
});

/// The customer's next active appointment (requested/confirmed/en_route/
/// in_progress with the earliest scheduled start), or null.
final nextAppointmentProvider = Provider<AsyncValue<Appointment?>>((ref) {
  final appointments = ref.watch(myAppointmentsProvider);
  return appointments.whenData((list) {
    final active = list.where((a) => a.isUpcoming).toList()
      ..sort((a, b) => a.scheduledStart.compareTo(b.scheduledStart));
    return active.isEmpty ? null : active.first;
  });
});

/// Live single-appointment stream — the detail screen's status chip and
/// timeline update in realtime as the owner advances the job.
final appointmentProvider =
    StreamProvider.family<Appointment?, String>((ref, id) {
  final client = ref.watch(supabaseClientProvider);
  return client
      .from('appointments')
      .stream(primaryKey: ['id'])
      .eq('id', id)
      .map((rows) => rows.isEmpty ? null : Appointment.fromJson(rows.first));
});

/// Status-change audit trail for the timeline. Re-fetched whenever the live
/// appointment row's status changes.
final appointmentEventsProvider =
    FutureProvider.family<List<AppointmentEvent>, String>((ref, id) async {
  // Refetch when the live status changes.
  ref.watch(appointmentProvider(id)
      .select((async) => async.value?.status ?? AppointmentStatus.requested));
  final client = ref.watch(supabaseClientProvider);
  final rows = await client
      .from('appointment_events')
      .select()
      .eq('appointment_id', id)
      .order('created_at', ascending: true);
  return (rows as List<dynamic>)
      .map((r) => AppointmentEvent.fromJson(r as Map<String, dynamic>))
      .toList();
});

/// Service line items attached to an appointment (joined for names).
final appointmentServicesProvider =
    FutureProvider.family<List<ServiceItem>, String>((ref, id) async {
  final client = ref.watch(supabaseClientProvider);
  final rows = await client
      .from('appointment_services')
      .select('service_id, services(id, category_id, name, description, '
          'sort_order)')
      .eq('appointment_id', id);
  return (rows as List<dynamic>)
      .map((r) => (r as Map<String, dynamic>)['services'])
      .whereType<Map<String, dynamic>>()
      .map(ServiceItem.fromJson)
      .toList();
});

/// Payments for an appointment (customers can read their own rows via RLS).
/// Re-fetched when the live status changes (e.g. completed -> final payment
/// row appears).
final appointmentPaymentsProvider =
    FutureProvider.family<List<PaymentRow>, String>((ref, id) async {
  ref.watch(appointmentProvider(id)
      .select((async) => async.value?.status ?? AppointmentStatus.requested));
  final client = ref.watch(supabaseClientProvider);
  final rows = await client
      .from('payments')
      .select()
      .eq('appointment_id', id)
      .order('created_at', ascending: true);
  return (rows as List<dynamic>)
      .map((r) => PaymentRow.fromJson(r as Map<String, dynamic>))
      .toList();
});

/// A single address row (used by the appointment detail screen).
final addressByIdProvider =
    FutureProvider.family<Address?, String>((ref, id) async {
  final client = ref.watch(supabaseClientProvider);
  final row =
      await client.from('addresses').select().eq('id', id).maybeSingle();
  return row == null ? null : Address.fromJson(row);
});
