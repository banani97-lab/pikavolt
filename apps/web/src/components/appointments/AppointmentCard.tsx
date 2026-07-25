import Link from 'next/link';
import { ChevronRight, MapPin, Wrench } from 'lucide-react';
import type { AppointmentStatus } from '@pikavolt/core';
import { StatusBadge } from './StatusBadge';
import { formatApptStart } from '@/components/booking/format';

export interface AppointmentListItem {
  id: string;
  status: AppointmentStatus;
  scheduled_start: string;
  addressLine: string;
  serviceNames: string[];
}

export function AppointmentCard({ appointment }: { appointment: AppointmentListItem }) {
  return (
    <Link
      href={`/appointments/${appointment.id}`}
      className="group flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-surface p-5 transition-all hover:border-volt/50 hover:shadow-volt-glow"
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-white">{formatApptStart(appointment.scheduled_start)}</p>
          <StatusBadge status={appointment.status} />
        </div>
        {appointment.serviceNames.length > 0 && (
          <p className="flex items-center gap-1.5 truncate text-sm text-zinc-400">
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            {appointment.serviceNames.join(', ')}
          </p>
        )}
        {appointment.addressLine && (
          <p className="flex items-center gap-1.5 truncate text-sm text-zinc-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {appointment.addressLine}
          </p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-zinc-600 transition-colors group-hover:text-volt" />
    </Link>
  );
}
