/// Owner-side data providers and actions.
///
/// Detail sub-providers (events/services/payments/address) are reused from
/// features/appointments — they are role-agnostic and owner RLS grants full
/// read access.
library;

import 'package:flutter/foundation.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/constants.dart';
import '../../core/models/db_models.dart';
import '../../core/supabase_provider.dart';

/// Live stream of ALL appointments (owner RLS). Ordered soonest-first.
final ownerAppointmentsProvider = StreamProvider<List<Appointment>>((ref) {
  final client = ref.watch(supabaseClientProvider);
  return client
      .from('appointments')
      .stream(primaryKey: ['id'])
      .order('scheduled_start', ascending: true)
      .map((rows) => rows.map(Appointment.fromJson).toList());
});

/// A customer profile by id (owner can select all profiles per RLS).
final profileByIdProvider =
    FutureProvider.family<Profile?, String>((ref, id) async {
  final client = ref.watch(supabaseClientProvider);
  final row = await client
      .from('profiles')
      .select('id, role, full_name, phone')
      .eq('id', id)
      .maybeSingle();
  return row == null ? null : Profile.fromJson(row);
});

/// Quick stats for the Today screen strip.
class OwnerStats {
  const OwnerStats({
    required this.jobsToday,
    required this.pendingRequests,
    required this.pendingFinals,
  });

  final int jobsToday;
  final int pendingRequests;
  final int pendingFinals;
}

final ownerStatsProvider = Provider<AsyncValue<OwnerStats>>((ref) {
  return ref.watch(ownerAppointmentsProvider).whenData((appointments) {
    final now = DateTime.now();
    bool isToday(DateTime d) =>
        d.year == now.year && d.month == now.month && d.day == now.day;
    return OwnerStats(
      jobsToday: appointments
          .where((a) =>
              isToday(a.scheduledStart) &&
              a.status != AppointmentStatus.cancelled &&
              a.status != AppointmentStatus.noShow)
          .length,
      pendingRequests: appointments
          .where((a) => a.status == AppointmentStatus.requested)
          .length,
      pendingFinals: appointments
          .where((a) => a.status == AppointmentStatus.completed)
          .length,
    );
  });
});

/// Outcome of the job-complete flow's final-payment kick-off.
enum FinalPaymentKickoff {
  /// The API accepted the request (charged / link sent / requires action).
  requested,

  /// Endpoint not ready (401 bearer auth pending / 404/501 stub / 503
  /// Stripe placeholder) — collect later, job completion is NOT blocked.
  unavailable,
}

/// Owner write actions. All status changes go straight to Supabase — the
/// owner RLS policy allows them and the DB trigger enforces the legal state
/// machine (mirrored client-side by AppointmentStatus.allowedTransitions).
class OwnerAppointmentActions {
  const OwnerAppointmentActions(this._ref);

  final Ref _ref;

  Future<void> transition(
    String appointmentId,
    AppointmentStatus to, {
    Map<String, dynamic> extra = const {},
  }) async {
    final client = _ref.read(supabaseClientProvider);
    await client
        .from('appointments')
        .update({'status': to.wire, ...extra}).eq('id', appointmentId);
  }

  /// Tells the web app to send the customer the "your electrician is on the
  /// way" email + push with a tracking link.
  ///
  /// The owner's tap updates Supabase directly, so it bypasses the web admin
  /// server action that would otherwise notify. Best-effort by design: the
  /// trip and tracking work regardless, so failures are logged, never surfaced.
  Future<void> notifyEnRoute(String appointmentId) async {
    try {
      await _ref.read(apiClientProvider).notifyEnRoute(appointmentId);
    } catch (e) {
      debugPrint('notifyEnRoute: customer notification failed: $e');
    }
  }

  Future<void> cancel(String appointmentId, String reason) => transition(
        appointmentId,
        AppointmentStatus.cancelled,
        extra: {'cancelled_reason': reason},
      );

  Future<void> markNoShow(String appointmentId) =>
      transition(appointmentId, AppointmentStatus.noShow);

  Future<void> saveJobNotes(String appointmentId, String notes) async {
    final client = _ref.read(supabaseClientProvider);
    await client
        .from('appointments')
        .update({'job_notes': notes}).eq('id', appointmentId);
  }

  /// Job Complete: saves the total + notes, transitions
  /// in_progress -> completed, then kicks off the final payment via
  /// `POST /api/payments/final`.
  ///
  /// The payment call is best-effort: 401 (bearer auth being wired) and 503
  /// (Stripe placeholder) — or any other failure — return
  /// [FinalPaymentKickoff.unavailable] and never block completion.
  Future<FinalPaymentKickoff> completeJob(
    String appointmentId, {
    required int jobTotalCents,
    required String notes,
  }) async {
    await transition(
      appointmentId,
      AppointmentStatus.completed,
      extra: {
        'job_total_cents': jobTotalCents,
        'job_notes': notes.trim().isEmpty ? null : notes.trim(),
      },
    );

    try {
      await _ref.read(apiClientProvider).requestFinalPayment(appointmentId);
      return FinalPaymentKickoff.requested;
    } on ApiException catch (e) {
      debugPrint('completeJob: final payment unavailable (${e.statusCode})');
      return FinalPaymentKickoff.unavailable;
    } catch (e) {
      debugPrint('completeJob: final payment call failed: $e');
      return FinalPaymentKickoff.unavailable;
    }
  }
}

final ownerAppointmentActionsProvider =
    Provider<OwnerAppointmentActions>((ref) => OwnerAppointmentActions(ref));
