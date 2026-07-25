import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/constants.dart';
import '../../core/env.dart';
import '../../core/models/db_models.dart';
import '../../core/supabase_provider.dart';
import '../../core/theme.dart';
import '../../core/widgets/mascot.dart';
import '../../core/widgets/status_chip.dart';
import '../appointments/appointments_providers.dart';
import '../booking/slot_utils.dart';

/// Customer home (/customer/home): greeting, live next-appointment card,
/// big actions, and the 24/7 emergency click-to-call card.
class CustomerHomeScreen extends ConsumerWidget {
  const CustomerHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentProfileProvider).value;
    final nextAppointment = ref.watch(nextAppointmentProvider);
    final textTheme = Theme.of(context).textTheme;

    final fullName = profile?.fullName?.trim();
    final firstName = (fullName == null || fullName.isEmpty)
        ? null
        : fullName.split(RegExp(r'\s+')).first;

    return Scaffold(
      appBar: AppBar(
        title: const Text('PIKAVOLT'),
        actions: [
          IconButton(
            tooltip: 'Account',
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.go('/customer/account'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Greeting + mascot
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.teal, AppColors.background],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.outline),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        firstName == null
                            ? 'HEY THERE!'
                            : 'HEY, ${firstName.toUpperCase()}!',
                        style: textTheme.headlineMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        BusinessInfo.primaryTagline,
                        style: textTheme.bodyMedium
                            ?.copyWith(color: AppColors.mutedText),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Mascot(height: 96),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Next appointment (live — realtime stream keeps the chip fresh)
          if (nextAppointment.value case final appointment?) ...[
            _NextAppointmentCard(appointment: appointment),
            const SizedBox(height: 16),
          ],

          // Big actions
          _HomeTile(
            icon: Icons.calendar_month_outlined,
            title: 'Book a Service',
            subtitle: 'Free estimates • \$150 service call',
            onTap: () => context.go('/customer/book'),
          ),
          _HomeTile(
            icon: Icons.assignment_outlined,
            title: 'My Appointments',
            subtitle: 'Track, cancel, or review jobs',
            onTap: () => context.go('/customer/appointments'),
          ),
          _HomeTile(
            icon: Icons.chat_bubble_outline,
            title: 'Chat with Pikavolt',
            subtitle: 'Questions about your job? Message us.',
            onTap: () => context.go('/customer/chat'),
            leadingWidget: const MascotFace(size: 40, voltRing: true),
          ),
          const SizedBox(height: 8),

          // 24/7 emergency — click-to-call only
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppColors.emergency),
            ),
            child: ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              leading:
                  const Icon(Icons.bolt_rounded, color: AppColors.emergency),
              title: Text(
                '24/7 EMERGENCY',
                style: textTheme.titleMedium?.copyWith(
                  color: AppColors.emergency,
                  fontWeight: FontWeight.w800,
                ),
              ),
              subtitle: const Text(
                'Tap to call now — emergencies are phone-only.',
                style: TextStyle(color: AppColors.mutedText),
              ),
              trailing:
                  const Icon(Icons.phone_in_talk, color: AppColors.emergency),
              onTap: () => _callEmergencyLine(context),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _callEmergencyLine(BuildContext context) async {
    final digits = Env.ownerPhoneNumber.replaceAll(RegExp(r'[^0-9+]'), '');
    final uri = Uri(scheme: 'tel', path: digits);
    final messenger = ScaffoldMessenger.of(context);
    var launched = false;
    try {
      launched = await launchUrl(uri);
    } catch (_) {
      launched = false;
    }
    if (!launched) {
      messenger.showSnackBar(SnackBar(
        content: Text('Call us at ${Env.ownerPhoneNumber}'),
      ));
    }
  }
}

class _NextAppointmentCard extends StatelessWidget {
  const _NextAppointmentCard({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context) {
    final start = appointment.scheduledStart;
    final textTheme = Theme.of(context).textTheme;
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.voltYellow),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.go('/customer/appointments/${appointment.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('NEXT APPOINTMENT', style: textTheme.labelLarge),
                  StatusChip(status: appointment.status),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                '${weekdayShort(start)}, ${monthShort(start)} ${start.day} '
                'at ${timeLabel(start)}',
                style: textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
              if (appointment.status == AppointmentStatus.enRoute) ...[
                const SizedBox(height: 8),
                const Text(
                  'Your electrician is on the way — tap to track live.',
                  style: TextStyle(color: AppColors.voltYellow),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeTile extends StatelessWidget {
  const _HomeTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.leadingWidget,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Widget? leadingWidget;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          leading: leadingWidget ?? Icon(icon, color: AppColors.voltYellow),
          title: Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          subtitle: Text(
            subtitle,
            style: const TextStyle(color: AppColors.mutedText),
          ),
          trailing:
              const Icon(Icons.chevron_right, color: AppColors.mutedText),
          onTap: onTap,
        ),
      ),
    );
  }
}
