import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/constants.dart';
import '../../core/models/db_models.dart';
import '../../core/money.dart';
import '../../core/theme.dart';
import '../../core/widgets/status_chip.dart';
import '../appointments/appointments_providers.dart';
import '../booking/slot_utils.dart';
import '../tracking/owner_trip_service.dart';
import 'owner_actions.dart';
import 'owner_providers.dart';
import 'owner_widgets.dart';

/// Owner job view (/owner/appointments/:id): full job info, payments, job
/// notes, event timeline, and the big thumb-friendly action flow driven by
/// [ownerActionsFor] (which mirrors the DB state machine).
class OwnerAppointmentDetailScreen extends ConsumerWidget {
  const OwnerAppointmentDetailScreen({super.key, required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointmentAsync = ref.watch(appointmentProvider(appointmentId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('JOB'),
        leading: BackButton(onPressed: () => context.go('/owner/today')),
      ),
      body: Column(
        children: [
          const OwnerTripBanner(),
          Expanded(
            child: appointmentAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text(
                  'Could not load this job.\n$e',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.mutedText),
                ),
              ),
              data: (appointment) => appointment == null
                  ? const Center(
                      child: Text(
                        'Job not found.',
                        style: TextStyle(color: AppColors.mutedText),
                      ),
                    )
                  : _JobBody(appointment: appointment),
            ),
          ),
        ],
      ),
    );
  }
}

class _JobBody extends ConsumerWidget {
  const _JobBody({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final start = appointment.scheduledStart;
    final textTheme = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        '${weekdayShort(start)}, ${monthShort(start)} '
                        '${start.day} • ${timeLabel(start)}–'
                        '${timeLabel(appointment.scheduledEnd)}',
                        style: textTheme.titleLarge
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    StatusChip(status: appointment.status),
                  ],
                ),
                if (appointment.isEmergency)
                  const Padding(
                    padding: EdgeInsets.only(top: 6),
                    child: Text(
                      'EMERGENCY CALL',
                      style: TextStyle(
                        color: AppColors.emergency,
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                if (appointment.description != null &&
                    appointment.description!.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    appointment.description!,
                    style: const TextStyle(color: AppColors.mutedText),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // ---- THE ACTION FLOW ----
        _ActionFlow(appointment: appointment),

        _CustomerCard(customerId: appointment.customerId),
        const SizedBox(height: 12),
        _LocationCard(addressId: appointment.addressId),
        const SizedBox(height: 12),
        _ServicesCard(appointmentId: appointment.id),
        const SizedBox(height: 12),
        _PaymentsCard(appointment: appointment),
        const SizedBox(height: 12),
        _JobNotesCard(appointment: appointment),
        const SizedBox(height: 12),
        _TimelineCard(appointmentId: appointment.id),
        const SizedBox(height: 32),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Action flow
// ---------------------------------------------------------------------------

class _ActionFlow extends ConsumerStatefulWidget {
  const _ActionFlow({required this.appointment});

  final Appointment appointment;

  @override
  ConsumerState<_ActionFlow> createState() => _ActionFlowState();
}

class _ActionFlowState extends ConsumerState<_ActionFlow> {
  bool _busy = false;

  Appointment get appointment => widget.appointment;

  OwnerAppointmentActions get _actions =>
      ref.read(ownerAppointmentActionsProvider);

  OwnerTripService get _trip => ref.read(ownerTripProvider.notifier);

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('That didn\'t work: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _approve() => _run(() async {
        await _actions.transition(appointment.id, AppointmentStatus.confirmed);
        _snack('Job approved — the customer has been confirmed.');
      });

  Future<void> _onMyWay() => _run(() async {
        // Pre-flight the location permission so the owner can decide what to
        // do before we commit the transition.
        var withTracking = true;
        final permission = await _trip.ensurePermission();
        if (permission != TripStartResult.started) {
          if (!mounted) return;
          final proceed = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Location unavailable'),
              content: Text(
                permission == TripStartResult.serviceDisabled
                    ? 'Location services are off, so the customer won\'t '
                        'see live tracking. Head out anyway?'
                    : 'Location permission is missing, so the customer '
                        'won\'t see live tracking. Head out anyway?',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Not yet'),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: const Text('Go without tracking'),
                ),
              ],
            ),
          );
          if (proceed != true) return;
          withTracking = false;
        }

        await _actions.transition(appointment.id, AppointmentStatus.enRoute);
        // Fire-and-forget: emails/pushes the customer their tracking link.
        unawaited(_actions.notifyEnRoute(appointment.id));
        if (withTracking) {
          final result = await _trip.start(appointment.id);
          _snack(result == TripStartResult.started
              ? 'You\'re en route — sharing your live location.'
              : 'En route. Live tracking could not start '
                  '(${result.name}).');
        } else {
          _snack('You\'re en route.');
        }
      });

  Future<void> _arrived() => _run(() async {
        await _trip.stop(endSession: true);
        await _actions.transition(
            appointment.id, AppointmentStatus.inProgress);
        _snack('Marked in progress — tracking stopped.');
      });

  Future<void> _complete() async {
    final result = await showModalBottomSheet<_CompleteJobResult>(
      context: context,
      isScrollControlled: true,
      builder: (context) =>
          _CompleteJobSheet(initialNotes: appointment.jobNotesOrEmpty),
    );
    if (result == null) return;
    await _run(() async {
      // Belt-and-braces: tracking should already be off after ARRIVED.
      if (ref.read(ownerTripProvider).isActiveFor(appointment.id)) {
        await _trip.stop(endSession: true);
      }
      final kickoff = await _actions.completeJob(
        appointment.id,
        jobTotalCents: result.totalCents,
        notes: result.notes,
      );
      ref.invalidate(appointmentPaymentsProvider(appointment.id));
      _snack(kickoff == FinalPaymentKickoff.requested
          ? 'Job complete — final payment requested.'
          : 'Job complete. The final payment will be collected once '
              'payments are configured.');
    });
  }

  Future<void> _cancel() async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel this job?'),
        content: TextField(
          controller: reasonController,
          decoration: const InputDecoration(
            labelText: 'Reason (shared with the customer)',
          ),
          maxLines: 2,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep it'),
          ),
          TextButton(
            style:
                TextButton.styleFrom(foregroundColor: AppColors.emergency),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cancel job'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final reason = reasonController.text.trim();
    await _run(() async {
      if (ref.read(ownerTripProvider).isActiveFor(appointment.id)) {
        await _trip.stop(endSession: true);
      }
      await _actions.cancel(
        appointment.id,
        reason.isEmpty ? 'cancelled by Pikavolt' : reason,
      );
      _snack('Job cancelled.');
    });
  }

  Future<void> _noShow() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mark as no-show?'),
        content: const Text(
            'Use this when the customer wasn\'t there for the appointment.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Back'),
          ),
          TextButton(
            style:
                TextButton.styleFrom(foregroundColor: AppColors.emergency),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('No-show'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _run(() async {
      if (ref.read(ownerTripProvider).isActiveFor(appointment.id)) {
        await _trip.stop(endSession: true);
      }
      await _actions.markNoShow(appointment.id);
      _snack('Marked as a no-show.');
    });
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _dispatch(OwnerAction action) => switch (action) {
        OwnerAction.approve => _approve(),
        OwnerAction.onMyWay => _onMyWay(),
        OwnerAction.arrived => _arrived(),
        OwnerAction.complete => _complete(),
        OwnerAction.cancel => _cancel(),
        OwnerAction.noShow => _noShow(),
      };

  IconData _icon(OwnerAction action) => switch (action) {
        OwnerAction.approve => Icons.check_circle_outline,
        OwnerAction.onMyWay => Icons.navigation_outlined,
        OwnerAction.arrived => Icons.flag_outlined,
        OwnerAction.complete => Icons.task_alt,
        OwnerAction.cancel => Icons.close,
        OwnerAction.noShow => Icons.person_off_outlined,
      };

  @override
  Widget build(BuildContext context) {
    final actions = ownerActionsFor(appointment.status);
    if (actions.isEmpty) return const SizedBox.shrink();

    final primary = actions.where((a) => a.isPrimary).toList();
    final secondary = actions.where((a) => !a.isPrimary).toList();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final action in primary) ...[
            SizedBox(
              height: 60,
              child: ElevatedButton.icon(
                icon: Icon(_icon(action), size: 26),
                label: Text(
                  _busy ? 'WORKING…' : action.label,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
                onPressed: _busy ? null : () => unawaited(_dispatch(action)),
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (secondary.isNotEmpty)
            Row(
              children: [
                for (final action in secondary) ...[
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: Icon(_icon(action), size: 18),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.emergency,
                        side: BorderSide(
                          color:
                              AppColors.emergency.withValues(alpha: 0.6),
                        ),
                      ),
                      label: Text(action.label),
                      onPressed:
                          _busy ? null : () => unawaited(_dispatch(action)),
                    ),
                  ),
                  if (action != secondary.last) const SizedBox(width: 10),
                ],
              ],
            ),
        ],
      ),
    );
  }
}

/// Result of the Job Complete sheet.
class _CompleteJobResult {
  const _CompleteJobResult({required this.totalCents, required this.notes});

  final int totalCents;
  final String notes;
}

class _CompleteJobSheet extends StatefulWidget {
  const _CompleteJobSheet({required this.initialNotes});

  final String initialNotes;

  @override
  State<_CompleteJobSheet> createState() => _CompleteJobSheetState();
}

class _CompleteJobSheetState extends State<_CompleteJobSheet> {
  final _formKey = GlobalKey<FormState>();
  final _totalController = TextEditingController();
  late final _notesController =
      TextEditingController(text: widget.initialNotes);

  static const int _minTotalCents = BusinessInfo.serviceCallFeeCents; // $150

  @override
  void dispose() {
    _totalController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  /// Parses "480", "480.50", "$1,250" -> cents. Null when unparseable.
  static int? parseDollarsToCents(String input) {
    final cleaned = input.replaceAll(RegExp(r'[$,\s]'), '');
    if (cleaned.isEmpty) return null;
    final value = double.tryParse(cleaned);
    if (value == null) return null;
    return (value * 100).round();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(_CompleteJobResult(
      totalCents: parseDollarsToCents(_totalController.text)!,
      notes: _notesController.text,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('JOB COMPLETE',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 4),
            const Text(
              'Enter the total for the job — the deposit already paid '
              'counts toward it.',
              style: TextStyle(color: AppColors.mutedText, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _totalController,
              autofocus: true,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Job total',
                prefixText: '\$ ',
              ),
              validator: (value) {
                final cents = parseDollarsToCents(value ?? '');
                if (cents == null) return 'Enter the job total in dollars';
                if (cents < _minTotalCents) {
                  return 'Minimum is ${formatCents(_minTotalCents)} '
                      '(service call fee)';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notesController,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Job notes (what was done)',
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              icon: const Icon(Icons.task_alt),
              label: const Text('COMPLETE & REQUEST PAYMENT'),
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Info cards
// ---------------------------------------------------------------------------

class _CustomerCard extends ConsumerWidget {
  const _CustomerCard({required this.customerId});

  final String customerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final customer = ref.watch(profileByIdProvider(customerId)).value;
    final phone = customer?.phone;
    return _SectionCard(
      title: 'CUSTOMER',
      child: Row(
        children: [
          const Icon(Icons.person_outline, color: AppColors.amber),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              customer?.fullName ?? 'Loading…',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          if (phone != null && phone.isNotEmpty)
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 44),
                padding: const EdgeInsets.symmetric(horizontal: 14),
              ),
              icon: const Icon(Icons.phone, size: 18),
              label: const Text('CALL'),
              onPressed: () => unawaited(launchPhone(context, phone)),
            ),
        ],
      ),
    );
  }
}

class _LocationCard extends ConsumerWidget {
  const _LocationCard({required this.addressId});

  final String addressId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final address = ref.watch(addressByIdProvider(addressId)).value;
    return _SectionCard(
      title: 'LOCATION',
      child: address == null
          ? const Text('Loading…',
              style: TextStyle(color: AppColors.mutedText))
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.location_on_outlined,
                    color: AppColors.amber),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${address.label == null ? '' : '${address.label}\n'}'
                    '${address.oneLine}',
                  ),
                ),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 44),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  icon: const Icon(Icons.map_outlined, size: 18),
                  label: const Text('MAP'),
                  onPressed: () => unawaited(launchMaps(context, address)),
                ),
              ],
            ),
    );
  }
}

class _ServicesCard extends ConsumerWidget {
  const _ServicesCard({required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync = ref.watch(appointmentServicesProvider(appointmentId));
    return _SectionCard(
      title: 'SERVICES',
      child: servicesAsync.when(
        loading: () => const Text('Loading…',
            style: TextStyle(color: AppColors.mutedText)),
        error: (e, _) => const Text('Could not load services.',
            style: TextStyle(color: AppColors.mutedText)),
        data: (services) => services.isEmpty
            ? const Text('No line items recorded.',
                style: TextStyle(color: AppColors.mutedText))
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final service in services)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          const Icon(Icons.bolt_rounded,
                              size: 16, color: AppColors.amber),
                          const SizedBox(width: 8),
                          Expanded(child: Text(service.name)),
                        ],
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

class _PaymentsCard extends ConsumerWidget {
  const _PaymentsCard({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentsAsync =
        ref.watch(appointmentPaymentsProvider(appointment.id));
    return _SectionCard(
      title: 'PAYMENTS',
      child: paymentsAsync.when(
        loading: () => const Text('Loading…',
            style: TextStyle(color: AppColors.mutedText)),
        error: (e, _) => const Text('Could not load payments.',
            style: TextStyle(color: AppColors.mutedText)),
        data: (payments) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (appointment.jobTotalCents != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text('Job total',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                    Text(
                      formatCents(appointment.jobTotalCents!),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.voltYellow,
                      ),
                    ),
                  ],
                ),
              ),
            if (payments.isEmpty)
              const Text('No payments recorded yet.',
                  style: TextStyle(color: AppColors.mutedText)),
            for (final payment in payments)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Icon(
                      payment.isSucceeded
                          ? Icons.check_circle_outline
                          : payment.status == 'refunded'
                              ? Icons.undo
                              : Icons.schedule,
                      size: 16,
                      color: payment.isSucceeded
                          ? const Color(0xFF34D399)
                          : AppColors.mutedText,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${_kindLabel(payment.kind)} — ${payment.status}',
                      ),
                    ),
                    Text(
                      formatCents(payment.amountCents),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _kindLabel(String? kind) => switch (kind) {
        'deposit' => 'Booking deposit',
        'final' => 'Final balance',
        'extra' => 'Additional charge',
        _ => 'Payment',
      };
}

class _JobNotesCard extends ConsumerStatefulWidget {
  const _JobNotesCard({required this.appointment});

  final Appointment appointment;

  @override
  ConsumerState<_JobNotesCard> createState() => _JobNotesCardState();
}

class _JobNotesCardState extends ConsumerState<_JobNotesCard> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.appointment.jobNotesOrEmpty);
  bool _dirty = false;
  bool _saving = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(ownerAppointmentActionsProvider)
          .saveJobNotes(widget.appointment.id, _controller.text.trim());
      if (mounted) setState(() => _dirty = false);
      messenger.showSnackBar(
          const SnackBar(content: Text('Job notes saved.')));
    } catch (e) {
      messenger
          .showSnackBar(SnackBar(content: Text('Could not save notes: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'JOB NOTES',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _controller,
            maxLines: 4,
            minLines: 2,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              hintText: 'Materials, findings, follow-ups…',
            ),
            onChanged: (_) {
              if (!_dirty) setState(() => _dirty = true);
            },
          ),
          if (_dirty) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              icon: const Icon(Icons.save_outlined, size: 18),
              label: Text(_saving ? 'SAVING…' : 'SAVE NOTES'),
              onPressed: _saving ? null : () => unawaited(_save()),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Timeline (mirrors the customer detail screen's private timeline widget)
// ---------------------------------------------------------------------------

class _TimelineCard extends ConsumerWidget {
  const _TimelineCard({required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(appointmentEventsProvider(appointmentId));
    return _SectionCard(
      title: 'TIMELINE',
      child: eventsAsync.when(
        loading: () => const Text('Loading…',
            style: TextStyle(color: AppColors.mutedText)),
        error: (e, _) => const Text('Could not load the timeline.',
            style: TextStyle(color: AppColors.mutedText)),
        data: (events) => events.isEmpty
            ? const Text('No events yet.',
                style: TextStyle(color: AppColors.mutedText))
            : Column(
                children: [
                  for (var i = 0; i < events.length; i++)
                    _TimelineRow(
                      event: events[i],
                      isLast: i == events.length - 1,
                    ),
                ],
              ),
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.event, required this.isLast});

  final AppointmentEvent event;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final status = event.toStatus;
    final color = status == null ? AppColors.mutedText : statusColor(status);
    final when = event.createdAt;
    final label = status == null
        ? 'Updated'
        : event.fromStatus == null
            ? 'Requested'
            : status.label;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Container(
                width: 10,
                height: 10,
                margin: const EdgeInsets.only(top: 4),
                decoration:
                    BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              if (!isLast)
                Expanded(
                  child: Container(width: 2, color: AppColors.outline),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                    '${monthShort(when)} ${when.day} • ${timeLabel(when)}',
                    style: const TextStyle(
                      color: AppColors.mutedText,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context)
                  .textTheme
                  .labelLarge
                  ?.copyWith(letterSpacing: 1.1),
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}
