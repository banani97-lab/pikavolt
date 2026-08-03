import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/constants.dart';
import '../../core/models/db_models.dart';
import '../../core/supabase_provider.dart';
import '../../core/theme.dart';
import '../../core/widgets/mascot.dart';
import '../../core/widgets/status_chip.dart';
import '../appointments/appointments_providers.dart' show addressByIdProvider;
import '../booking/slot_utils.dart';
import '../notifications/fcm_service.dart';
import '../tracking/owner_trip_service.dart';
import 'owner_chat_providers.dart';
import 'owner_providers.dart';
import 'owner_widgets.dart';

/// Owner "Today" dashboard (/owner/today): quick stats, today's schedule,
/// upcoming jobs, live-trip banner, chat inbox entry, sign-out.
/// Realtime via [ownerAppointmentsProvider] + pull-to-refresh.
class OwnerTodayScreen extends ConsumerWidget {
  const OwnerTodayScreen({super.key});

  Future<void> _signOut(WidgetRef ref) async {
    // Stop any live trip (writes ended_at) and drop the device token before
    // the session disappears.
    await ref.read(ownerTripProvider.notifier).stop(endSession: true);
    await ref.read(fcmServiceProvider).unregisterToken();
    await ref.read(supabaseClientProvider).auth.signOut();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointmentsAsync = ref.watch(ownerAppointmentsProvider);
    final unread = ref.watch(ownerUnreadCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('TODAY'),
        actions: [
          IconButton(
            tooltip: 'Calendar',
            onPressed: () => context.push('/owner/calendar'),
            icon: const Icon(Icons.calendar_month_outlined),
          ),
          IconButton(
            tooltip: 'Messages',
            onPressed: () => context.go('/owner/chat'),
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              backgroundColor: AppColors.emergency,
              child: const Icon(Icons.chat_bubble_outline),
            ),
          ),
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => unawaited(_signOut(ref)),
          ),
        ],
      ),
      body: Column(
        children: [
          const OwnerTripBanner(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(ownerAppointmentsProvider);
                // Give the stream a beat to re-emit.
                await Future<void>.delayed(const Duration(milliseconds: 400));
              },
              child: appointmentsAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    Text(
                      'Could not load the schedule.\n$e',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.mutedText),
                    ),
                  ],
                ),
                data: (appointments) =>
                    _TodayBody(appointments: appointments),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TodayBody extends ConsumerWidget {
  const _TodayBody({required this.appointments});

  final List<Appointment> appointments;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final today = dateOnly(now);
    final tomorrow = today.add(const Duration(days: 1));

    final todays = appointments
        .where((a) =>
            !a.scheduledStart.isBefore(today) &&
            a.scheduledStart.isBefore(tomorrow))
        .toList()
      ..sort((a, b) => a.scheduledStart.compareTo(b.scheduledStart));
    final upcoming = appointments
        .where((a) =>
            !a.scheduledStart.isBefore(tomorrow) &&
            (a.isUpcoming || a.status == AppointmentStatus.requested))
        .toList()
      ..sort((a, b) => a.scheduledStart.compareTo(b.scheduledStart));

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        const _StatsStrip(),
        const SizedBox(height: 20),
        Text("TODAY'S JOBS",
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 10),
        if (todays.isEmpty)
          const _EmptyCard(text: 'Nothing on the books today — enjoy it!')
        else
          for (final appointment in todays) ...[
            _JobTile(appointment: appointment),
            const SizedBox(height: 10),
          ],
        const SizedBox(height: 16),
        Text('UPCOMING', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 10),
        if (upcoming.isEmpty)
          const _EmptyCard(text: 'No upcoming jobs yet.')
        else
          for (final appointment in upcoming.take(15)) ...[
            _JobTile(appointment: appointment, showDate: true),
            const SizedBox(height: 10),
          ],
        const SizedBox(height: 24),
        const Center(child: Mascot(height: 90)),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _StatsStrip extends ConsumerWidget {
  const _StatsStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(ownerStatsProvider).value;
    return Row(
      children: [
        _StatCard(
          label: 'JOBS TODAY',
          value: stats?.jobsToday,
          color: AppColors.voltYellow,
        ),
        const SizedBox(width: 10),
        _StatCard(
          label: 'REQUESTS',
          value: stats?.pendingRequests,
          color: AppColors.amber,
        ),
        const SizedBox(width: 10),
        _StatCard(
          label: 'PENDING FINALS',
          value: stats?.pendingFinals,
          color: AppColors.arcBlue,
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int? value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Column(
            children: [
              Text(
                value?.toString() ?? '—',
                style: Theme.of(context)
                    .textTheme
                    .headlineMedium
                    ?.copyWith(color: color),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 10,
                  letterSpacing: 0.8,
                  fontWeight: FontWeight.w700,
                  color: AppColors.mutedText,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _JobTile extends ConsumerWidget {
  const _JobTile({required this.appointment, this.showDate = false});

  final Appointment appointment;
  final bool showDate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final customer =
        ref.watch(profileByIdProvider(appointment.customerId)).value;
    final address =
        ref.watch(addressByIdProvider(appointment.addressId)).value;
    final start = appointment.scheduledStart;
    final phone = customer?.phone;

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.go('/owner/appointments/${appointment.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      showDate
                          ? '${weekdayShort(start)}, ${monthShort(start)} '
                              '${start.day} • ${timeLabel(start)}'
                          : '${timeLabel(start)} – '
                              '${timeLabel(appointment.scheduledEnd)}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  StatusChip(status: appointment.status),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.person_outline,
                      size: 16, color: AppColors.amber),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      customer?.fullName ?? '…',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  if (phone != null && phone.isNotEmpty)
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      tooltip: 'Call $phone',
                      icon: const Icon(Icons.phone,
                          size: 20, color: AppColors.arcBlue),
                      onPressed: () =>
                          unawaited(launchPhone(context, phone)),
                    ),
                ],
              ),
              if (address != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on_outlined,
                          size: 16, color: AppColors.mutedText),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          address.oneLine,
                          style: const TextStyle(
                            color: AppColors.mutedText,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              if (appointment.description != null &&
                  appointment.description!.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    appointment.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.mutedText,
                      fontSize: 13,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Center(
          child: Text(
            text,
            style: const TextStyle(color: AppColors.mutedText),
          ),
        ),
      ),
    );
  }
}
