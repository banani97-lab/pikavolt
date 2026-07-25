import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/constants.dart';
import '../../core/models/db_models.dart';
import '../../core/money.dart';
import '../../core/supabase_provider.dart';
import '../../core/theme.dart';
import '../../core/widgets/status_chip.dart';
import '../booking/slot_utils.dart';
import '../payments/payments_service.dart';
import 'appointments_providers.dart';

/// Customer appointment detail (/customer/appointments/:id).
///
/// Live status (realtime row subscription), event timeline, services,
/// address, payments summary, cancel (>= 24h refund policy), pay-remaining
/// -balance, and live tracking entry when the tech is en route.
class AppointmentDetailScreen extends ConsumerWidget {
  const AppointmentDetailScreen({super.key, required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointmentAsync = ref.watch(appointmentProvider(appointmentId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('APPOINTMENT'),
        leading: BackButton(
          onPressed: () => context.go('/customer/appointments'),
        ),
      ),
      body: appointmentAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(
            'Could not load this appointment.\n$e',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.mutedText),
          ),
        ),
        data: (appointment) {
          if (appointment == null) {
            return const Center(
              child: Text(
                'Appointment not found.',
                style: TextStyle(color: AppColors.mutedText),
              ),
            );
          }
          return _DetailBody(appointment: appointment);
        },
      ),
    );
  }
}

class _DetailBody extends ConsumerWidget {
  const _DetailBody({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final start = appointment.scheduledStart;
    final textTheme = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Header: when + live status
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
                        '${start.day} • ${timeLabel(start)}',
                        style: textTheme.titleLarge
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    StatusChip(status: appointment.status),
                  ],
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

        // Live tracking entry (tracking feature owned by another workstream)
        if (appointment.status == AppointmentStatus.enRoute) ...[
          ElevatedButton.icon(
            icon: const Icon(Icons.near_me),
            label: const Text('TRACK YOUR ELECTRICIAN'),
            onPressed: () => context
                .go('/customer/appointments/${appointment.id}/track'),
          ),
          const SizedBox(height: 12),
        ],

        _ServicesCard(appointmentId: appointment.id),
        const SizedBox(height: 12),
        _AddressCard(addressId: appointment.addressId),
        const SizedBox(height: 12),
        _PaymentsCard(appointment: appointment),
        const SizedBox(height: 12),
        _TimelineCard(appointmentId: appointment.id),
        const SizedBox(height: 16),

        if (appointment.canCancel) _CancelButton(appointment: appointment),
        const SizedBox(height: 24),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

class _ServicesCard extends ConsumerWidget {
  const _ServicesCard({required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync =
        ref.watch(appointmentServicesProvider(appointmentId));
    return _SectionCard(
      title: 'SERVICES',
      child: servicesAsync.when(
        loading: () => const _CardLoading(),
        error: (e, _) => const Text(
          'Could not load services.',
          style: TextStyle(color: AppColors.mutedText),
        ),
        data: (services) => services.isEmpty
            ? const Text(
                'No line items recorded.',
                style: TextStyle(color: AppColors.mutedText),
              )
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

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

class _AddressCard extends ConsumerWidget {
  const _AddressCard({required this.addressId});

  final String addressId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addressAsync = ref.watch(addressByIdProvider(addressId));
    return _SectionCard(
      title: 'LOCATION',
      child: addressAsync.when(
        loading: () => const _CardLoading(),
        error: (e, _) => const Text(
          'Could not load the address.',
          style: TextStyle(color: AppColors.mutedText),
        ),
        data: (address) => address == null
            ? const Text(
                'Address unavailable.',
                style: TextStyle(color: AppColors.mutedText),
              )
            : Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.location_on_outlined,
                      size: 18, color: AppColors.amber),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${address.label == null ? '' : '${address.label}\n'}'
                      '${address.oneLine}',
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

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
        loading: () => const _CardLoading(),
        error: (e, _) => const Text(
          'Could not load payments.',
          style: TextStyle(color: AppColors.mutedText),
        ),
        data: (payments) {
          final pendingFinal = payments
              .where((p) => p.kind == 'final' && p.isPending)
              .toList();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (payments.isEmpty)
                const Text(
                  'No payments recorded yet.',
                  style: TextStyle(color: AppColors.mutedText),
                ),
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
                          '${_kindLabel(payment.kind)} — '
                          '${payment.status}',
                        ),
                      ),
                      Text(
                        formatCents(payment.amountCents),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              if (pendingFinal.isNotEmpty) ...[
                const SizedBox(height: 8),
                _PayRemainingButton(
                  appointmentId: appointment.id,
                  amountCents: pendingFinal.first.amountCents,
                ),
              ],
            ],
          );
        },
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

class _PayRemainingButton extends ConsumerStatefulWidget {
  const _PayRemainingButton({
    required this.appointmentId,
    required this.amountCents,
  });

  final String appointmentId;
  final int amountCents;

  @override
  ConsumerState<_PayRemainingButton> createState() =>
      _PayRemainingButtonState();
}

class _PayRemainingButtonState extends ConsumerState<_PayRemainingButton> {
  bool _busy = false;

  Future<void> _pay() async {
    final messenger = ScaffoldMessenger.of(context);
    if (!PaymentsService.isEnabled) {
      messenger.showSnackBar(const SnackBar(
        content: Text('Payments are unavailable in this build — no Stripe '
            'key was configured.'),
      ));
      return;
    }
    setState(() => _busy = true);
    try {
      // INTEGRATION TODO(WS-B): confirm /api/payments/final request shape;
      // response contract is frozen (FinalPaymentResponseSchema).
      final response = await ref
          .read(apiClientProvider)
          .requestFinalPayment(widget.appointmentId);
      final clientSecret = response.paymentIntentClientSecret;
      if (clientSecret != null) {
        final result = await ref
            .read(paymentsServiceProvider)
            .presentPaymentSheet(clientSecret: clientSecret);
        if (result == PaymentSheetResult.success) {
          ref.invalidate(appointmentPaymentsProvider(widget.appointmentId));
          messenger.showSnackBar(
            const SnackBar(content: Text('Payment received — thank you!')),
          );
        } else if (result == PaymentSheetResult.failed) {
          messenger.showSnackBar(
            const SnackBar(content: Text('Payment failed — try again.')),
          );
        }
      } else {
        messenger.showSnackBar(SnackBar(
          content: Text(switch (response.status.wire) {
            'charged' => 'Your saved card was charged — all settled!',
            'payment_link_sent' =>
              'We emailed you a payment link — check your inbox.',
            _ => 'Payment status: ${response.status.wire}',
          }),
        ));
        ref.invalidate(appointmentPaymentsProvider(widget.appointmentId));
      }
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(
        content: Text(e.isNotImplemented
            ? 'Online payment isn\'t available yet — we\'ll send a payment '
                'link.'
            : 'Could not start the payment (${e.statusCode}).'),
      ));
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Could not start the payment: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      icon: const Icon(Icons.payment),
      label: Text(
        _busy
            ? 'STARTING…'
            : 'PAY REMAINING BALANCE '
                '(${formatCents(widget.amountCents)})',
      ),
      onPressed: _busy ? null : _pay,
    );
  }
}

// ---------------------------------------------------------------------------
// Timeline
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
        loading: () => const _CardLoading(),
        error: (e, _) => const Text(
          'Could not load the timeline.',
          style: TextStyle(color: AppColors.mutedText),
        ),
        data: (events) => events.isEmpty
            ? const Text(
                'No events yet.',
                style: TextStyle(color: AppColors.mutedText),
              )
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
    final color =
        status == null ? AppColors.mutedText : statusColor(status);
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
                  Text(
                    label,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
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

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

class _CancelButton extends ConsumerStatefulWidget {
  const _CancelButton({required this.appointment});

  final Appointment appointment;

  @override
  ConsumerState<_CancelButton> createState() => _CancelButtonState();
}

class _CancelButtonState extends ConsumerState<_CancelButton> {
  bool _busy = false;

  Future<void> _confirmCancel() async {
    final refundEligible =
        widget.appointment.refundEligibleAt(DateTime.now());
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel this appointment?'),
        content: Text(
          refundEligible
              ? 'You\'re cancelling more than 24 hours ahead, so your '
                  'deposit will be refunded in full.'
              : 'Heads up: this appointment starts within 24 hours, so the '
                  'deposit is non-refundable per our cancellation policy.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep it'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.emergency,
            ),
            child: const Text('Cancel appointment'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      // RLS permits customers to move their own requested/confirmed
      // appointment to cancelled; the DB trigger enforces the state machine.
      await ref.read(supabaseClientProvider).from('appointments').update({
        'status': AppointmentStatus.cancelled.wire,
        'cancelled_reason': 'cancelled by customer from mobile app',
      }).eq('id', widget.appointment.id);
      messenger.showSnackBar(SnackBar(
        content: Text(refundEligible
            ? 'Appointment cancelled — your deposit refund is on the way.'
            : 'Appointment cancelled.'),
      ));
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Could not cancel: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OutlinedButton.icon(
          icon: const Icon(Icons.close),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.emergency,
            side: const BorderSide(color: AppColors.emergency),
          ),
          label: Text(_busy ? 'CANCELLING…' : 'CANCEL APPOINTMENT'),
          onPressed: _busy ? null : _confirmCancel,
        ),
        const SizedBox(height: 6),
        const Text(
          'Full deposit refund when you cancel at least 24 hours before '
          'your slot.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.mutedText, fontSize: 12),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

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

class _CardLoading extends StatelessWidget {
  const _CardLoading();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 8),
      child: Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}
