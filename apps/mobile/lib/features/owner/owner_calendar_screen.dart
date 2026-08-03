import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/models/db_models.dart';
import '../../core/theme.dart';
import '../../core/widgets/status_chip.dart';
import '../booking/slot_utils.dart';
import 'owner_providers.dart';

/// Owner month calendar (/owner/calendar): jobs laid out on a month grid with
/// colored status dots. Tapping a day shows that day's agenda beneath the grid.
/// Realtime via [ownerAppointmentsProvider].
class OwnerCalendarScreen extends ConsumerStatefulWidget {
  const OwnerCalendarScreen({super.key});

  @override
  ConsumerState<OwnerCalendarScreen> createState() =>
      _OwnerCalendarScreenState();
}

class _OwnerCalendarScreenState extends ConsumerState<OwnerCalendarScreen> {
  late DateTime _month; // first-of-month being displayed
  late DateTime _selected; // day whose agenda is shown

  @override
  void initState() {
    super.initState();
    final now = dateOnly(DateTime.now());
    _month = DateTime(now.year, now.month);
    _selected = now;
  }

  void _shiftMonth(int delta) =>
      setState(() => _month = DateTime(_month.year, _month.month + delta));

  void _goToday() {
    final now = dateOnly(DateTime.now());
    setState(() {
      _month = DateTime(now.year, now.month);
      _selected = now;
    });
  }

  @override
  Widget build(BuildContext context) {
    final appointmentsAsync = ref.watch(ownerAppointmentsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('CALENDAR'),
        actions: [
          TextButton(
            onPressed: _goToday,
            child: const Text('TODAY'),
          ),
        ],
      ),
      body: appointmentsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Could not load the calendar.\n$e',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.mutedText),
            ),
          ),
        ),
        data: (appointments) => _body(context, appointments),
      ),
    );
  }

  Widget _body(BuildContext context, List<Appointment> appointments) {
    // Group jobs by calendar day.
    final byDay = <DateTime, List<Appointment>>{};
    for (final a in appointments) {
      byDay.putIfAbsent(dateOnly(a.scheduledStart), () => []).add(a);
    }
    for (final list in byDay.values) {
      list.sort((a, b) => a.scheduledStart.compareTo(b.scheduledStart));
    }

    // 6-week grid starting on the Sunday on/before the 1st.
    final firstOfMonth = DateTime(_month.year, _month.month, 1);
    final leading = firstOfMonth.weekday % 7; // Sun(7)->0 … Sat(6)->6
    final gridStart = firstOfMonth.subtract(Duration(days: leading));
    final days =
        List.generate(42, (i) => dateOnly(gridStart.add(Duration(days: i))));

    final today = dateOnly(DateTime.now());
    final selectedJobs = byDay[_selected] ?? const <Appointment>[];

    return Column(
      children: [
        _MonthHeader(
          label: DateFormat('MMMM yyyy').format(_month),
          onPrev: () => _shiftMonth(-1),
          onNext: () => _shiftMonth(1),
        ),
        const _WeekdayHeader(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Column(
            children: [
              for (var week = 0; week < 6; week++)
                Row(
                  children: [
                    for (var d = 0; d < 7; d++)
                      Expanded(
                        child: _DayCell(
                          day: days[week * 7 + d],
                          inMonth: days[week * 7 + d].month == _month.month,
                          isToday: isSameDay(days[week * 7 + d], today),
                          isSelected: isSameDay(days[week * 7 + d], _selected),
                          jobs: byDay[days[week * 7 + d]] ??
                              const <Appointment>[],
                          onTap: () =>
                              setState(() => _selected = days[week * 7 + d]),
                        ),
                      ),
                  ],
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        const Divider(height: 1),
        Expanded(child: _DayAgenda(day: _selected, jobs: selectedJobs)),
      ],
    );
  }
}

class _MonthHeader extends StatelessWidget {
  const _MonthHeader({
    required this.label,
    required this.onPrev,
    required this.onNext,
  });

  final String label;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: onPrev,
            icon: const Icon(Icons.chevron_left),
            tooltip: 'Previous month',
          ),
          Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          IconButton(
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right),
            tooltip: 'Next month',
          ),
        ],
      ),
    );
  }
}

class _WeekdayHeader extends StatelessWidget {
  const _WeekdayHeader();

  static const _labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      child: Row(
        children: [
          for (final l in _labels)
            Expanded(
              child: Center(
                child: Text(
                  l,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: AppColors.mutedText,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    required this.inMonth,
    required this.isToday,
    required this.isSelected,
    required this.jobs,
    required this.onTap,
  });

  final DateTime day;
  final bool inMonth;
  final bool isToday;
  final bool isSelected;
  final List<Appointment> jobs;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 56,
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.voltYellow.withValues(alpha: 0.12)
              : null,
          borderRadius: BorderRadius.circular(10),
          border: isSelected
              ? Border.all(color: AppColors.voltYellow.withValues(alpha: 0.6))
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 26,
              height: 26,
              alignment: Alignment.center,
              decoration: isToday
                  ? const BoxDecoration(
                      color: AppColors.voltYellow, shape: BoxShape.circle)
                  : null,
              child: Text(
                '${day.day}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isToday
                      ? AppColors.background
                      : inMonth
                          ? AppColors.onDark
                          : AppColors.mutedText.withValues(alpha: 0.45),
                ),
              ),
            ),
            const SizedBox(height: 3),
            SizedBox(height: 6, child: _dots()),
          ],
        ),
      ),
    );
  }

  Widget _dots() {
    if (jobs.isEmpty) return const SizedBox.shrink();
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (final j in jobs.take(4))
          Container(
            width: 5,
            height: 5,
            margin: const EdgeInsets.symmetric(horizontal: 1),
            decoration: BoxDecoration(
              color: statusColor(j.status),
              shape: BoxShape.circle,
            ),
          ),
      ],
    );
  }
}

class _DayAgenda extends StatelessWidget {
  const _DayAgenda({required this.day, required this.jobs});

  final DateTime day;
  final List<Appointment> jobs;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Text(
            DateFormat('EEEE, MMMM d').format(day).toUpperCase(),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
        ),
        if (jobs.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Nothing scheduled.',
              style: TextStyle(color: AppColors.mutedText),
            ),
          )
        else
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              itemCount: jobs.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) => _AgendaTile(appointment: jobs[i]),
            ),
          ),
      ],
    );
  }
}

class _AgendaTile extends ConsumerWidget {
  const _AgendaTile({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final customer =
        ref.watch(profileByIdProvider(appointment.customerId)).value;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.go('/owner/appointments/${appointment.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${timeLabel(appointment.scheduledStart)} – '
                      '${timeLabel(appointment.scheduledEnd)}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      customer?.fullName ?? '…',
                      style: const TextStyle(
                        color: AppColors.mutedText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (appointment.description != null &&
                        appointment.description!.trim().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          appointment.description!,
                          maxLines: 1,
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
              const SizedBox(width: 8),
              StatusChip(status: appointment.status),
            ],
          ),
        ),
      ),
    );
  }
}
