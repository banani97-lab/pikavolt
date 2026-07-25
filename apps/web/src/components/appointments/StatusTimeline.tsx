'use client';

import { motion } from 'framer-motion';
import {
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Hammer,
  Lock,
  Truck,
  UserX,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import type { AppointmentStatus } from '@pikavolt/core';
import { cn } from '@/lib/utils';
import { BUSINESS_TZ } from '@/components/booking/format';

export interface TimelineEvent {
  id: string;
  to_status: AppointmentStatus | null;
  created_at: string;
}

const STATUS_META: Record<AppointmentStatus, { label: string; blurb: string; icon: LucideIcon }> = {
  requested: { label: 'Requested', blurb: 'Deposit received — waiting on confirmation', icon: CalendarClock },
  confirmed: { label: 'Confirmed', blurb: 'You’re on the schedule', icon: CheckCircle2 },
  en_route: { label: 'On the way', blurb: 'Your electrician is heading to you', icon: Truck },
  in_progress: { label: 'In progress', blurb: 'Work is underway', icon: Hammer },
  completed: { label: 'Completed', blurb: 'Job done — settling the balance', icon: CircleDot },
  closed: { label: 'Closed', blurb: 'Paid in full — all wrapped up', icon: Lock },
  cancelled: { label: 'Cancelled', blurb: 'This appointment was cancelled', icon: XCircle },
  no_show: { label: 'No show', blurb: 'We couldn’t reach you at the property', icon: UserX },
};

const HAPPY_PATH: AppointmentStatus[] = [
  'requested',
  'confirmed',
  'en_route',
  'in_progress',
  'completed',
  'closed',
];

interface StatusTimelineProps {
  currentStatus: AppointmentStatus;
  events: TimelineEvent[];
}

/**
 * Animated vertical status timeline. Shows the happy path with reached steps
 * lit; terminal exits (cancelled / no_show) replace the remaining steps.
 */
export function StatusTimeline({ currentStatus, events }: StatusTimelineProps) {
  const reachedAt = new Map<AppointmentStatus, string>();
  for (const e of events) {
    if (e.to_status && !reachedAt.has(e.to_status)) reachedAt.set(e.to_status, e.created_at);
  }

  const isTerminalExit = currentStatus === 'cancelled' || currentStatus === 'no_show';
  const steps: AppointmentStatus[] = isTerminalExit
    ? [...HAPPY_PATH.filter((s) => reachedAt.has(s)), currentStatus]
    : HAPPY_PATH;

  const currentIdx = steps.indexOf(currentStatus);

  return (
    <ol className="relative space-y-0">
      {steps.map((status, i) => {
        const meta = STATUS_META[status];
        const reached = isTerminalExit ? true : i <= currentIdx;
        const isCurrent = status === currentStatus;
        const at = reachedAt.get(status);
        const Icon = meta.icon;
        const danger = status === 'cancelled' || status === 'no_show';

        return (
          <motion.li
            key={status}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07, duration: 0.25 }}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {/* Connector */}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 rounded',
                  reached && i < currentIdx ? 'bg-volt/70' : 'bg-white/10',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                danger && isCurrent
                  ? 'border-emergency bg-emergency/15 text-emergency'
                  : isCurrent
                    ? 'border-volt bg-volt/15 text-volt shadow-volt-glow'
                    : reached
                      ? 'border-volt/60 bg-volt/10 text-volt'
                      : 'border-white/10 bg-surface text-zinc-600',
              )}
            >
              {isCurrent && !danger && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full border border-volt/60"
                  animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <Icon className="h-4 w-4" />
            </span>
            <div className="pt-1">
              <p
                className={cn(
                  'text-sm font-semibold',
                  danger && isCurrent
                    ? 'text-emergency'
                    : reached
                      ? 'text-white'
                      : 'text-zinc-600',
                )}
              >
                {meta.label}
              </p>
              <p className={cn('text-xs', reached ? 'text-zinc-400' : 'text-zinc-600')}>
                {meta.blurb}
              </p>
              {at && reached && (
                <p className="mt-0.5 text-xs text-zinc-500">
                  {formatInTimeZone(new Date(at), BUSINESS_TZ, "MMM d, h:mm a 'ET'")}
                </p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
