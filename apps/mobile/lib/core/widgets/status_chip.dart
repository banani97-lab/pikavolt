import 'package:flutter/material.dart';

import '../constants.dart';
import '../theme.dart';

/// Brand color for each appointment status.
Color statusColor(AppointmentStatus status) => switch (status) {
      AppointmentStatus.requested => AppColors.amber,
      AppointmentStatus.confirmed => AppColors.arcBlue,
      AppointmentStatus.enRoute => AppColors.voltYellow,
      AppointmentStatus.inProgress => AppColors.voltYellow,
      AppointmentStatus.completed => const Color(0xFF34D399),
      AppointmentStatus.closed => AppColors.mutedText,
      AppointmentStatus.cancelled => AppColors.mutedText,
      AppointmentStatus.noShow => AppColors.emergency,
    };

/// Small colored chip for an appointment's lifecycle status.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, this.pulse = false});

  final AppointmentStatus status;

  /// Adds a live dot for in-flight statuses (en route / in progress).
  final bool pulse;

  @override
  Widget build(BuildContext context) {
    final color = statusColor(status);
    final live = status == AppointmentStatus.enRoute ||
        status == AppointmentStatus.inProgress;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (live) ...[
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
          ],
          Text(
            status.label.toUpperCase(),
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
            ),
          ),
        ],
      ),
    );
  }
}
