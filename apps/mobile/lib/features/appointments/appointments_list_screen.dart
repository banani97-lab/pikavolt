import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/models/db_models.dart';
import '../../core/theme.dart';
import '../../core/widgets/mascot.dart';
import '../../core/widgets/status_chip.dart';
import '../booking/slot_utils.dart';
import 'appointments_providers.dart';

/// Customer appointment list (/customer/appointments) — upcoming/past tabs,
/// live status chips, tap-through to detail.
class AppointmentsListScreen extends ConsumerWidget {
  const AppointmentsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointmentsAsync = ref.watch(myAppointmentsProvider);

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('MY APPOINTMENTS'),
          leading: BackButton(onPressed: () => context.go('/customer/home')),
          bottom: const TabBar(
            tabs: [Tab(text: 'Upcoming'), Tab(text: 'Past')],
          ),
        ),
        body: appointmentsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Could not load appointments.\n$e',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.mutedText),
              ),
            ),
          ),
          data: (appointments) {
            final upcoming =
                appointments.where((a) => a.isUpcoming).toList()
                  ..sort((a, b) =>
                      a.scheduledStart.compareTo(b.scheduledStart));
            final past = appointments.where((a) => !a.isUpcoming).toList()
              ..sort((a, b) => b.scheduledStart.compareTo(a.scheduledStart));
            return TabBarView(
              children: [
                _AppointmentList(
                  appointments: upcoming,
                  emptyTitle: 'NOTHING BOOKED YET',
                  emptyBody:
                      'When you book a service it shows up here with live '
                      'status updates.',
                ),
                _AppointmentList(
                  appointments: past,
                  emptyTitle: 'NO PAST JOBS',
                  emptyBody: 'Completed and cancelled jobs land here.',
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _AppointmentList extends StatelessWidget {
  const _AppointmentList({
    required this.appointments,
    required this.emptyTitle,
    required this.emptyBody,
  });

  final List<Appointment> appointments;
  final String emptyTitle;
  final String emptyBody;

  @override
  Widget build(BuildContext context) {
    if (appointments.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Mascot(height: 120),
              const SizedBox(height: 16),
              Text(
                emptyTitle,
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                emptyBody,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.mutedText),
              ),
            ],
          ),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: appointments.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final appointment = appointments[i];
        final start = appointment.scheduledStart;
        return Card(
          child: ListTile(
            onTap: () =>
                context.go('/customer/appointments/${appointment.id}'),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            title: Text(
              '${weekdayShort(start)}, ${monthShort(start)} ${start.day} '
              '• ${timeLabel(start)}',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: appointment.description == null ||
                    appointment.description!.trim().isEmpty
                ? null
                : Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      appointment.description!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.mutedText),
                    ),
                  ),
            trailing: StatusChip(status: appointment.status),
          ),
        );
      },
    );
  }
}
