import { Badge } from '@/components/ui/Badge';
import type { AppointmentStatus } from '@pikavolt/core';

const CONFIG: Record<AppointmentStatus, { label: string; variant: 'volt' | 'arc' | 'emergency' | 'neutral' }> = {
  requested: { label: 'Requested', variant: 'neutral' },
  confirmed: { label: 'Confirmed', variant: 'volt' },
  en_route: { label: 'On the way', variant: 'arc' },
  in_progress: { label: 'In progress', variant: 'arc' },
  completed: { label: 'Completed', variant: 'volt' },
  closed: { label: 'Closed', variant: 'neutral' },
  cancelled: { label: 'Cancelled', variant: 'emergency' },
  no_show: { label: 'No show', variant: 'emergency' },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const cfg = CONFIG[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
