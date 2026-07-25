import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import {
  BusinessHoursEditor,
  BlockedSlotsManager,
  type BlockedSlotItem,
} from '@/components/admin/AvailabilityEditor';
import type { DayHours } from './actions';
import { fmtDate, fmtTime } from '@/components/admin/format';

export const metadata: Metadata = { title: 'Availability' };
export const dynamic = 'force-dynamic';

export default async function AdminAvailabilityPage() {
  const supabase = await createClient();

  const [{ data: hours }, { data: blocks }] = await Promise.all([
    supabase
      .from('business_hours')
      .select('day_of_week, opens_at, closes_at, is_open')
      .order('day_of_week', { ascending: true }),
    supabase
      .from('blocked_slots')
      .select('id, starts_at, ends_at, reason')
      .gte('ends_at', new Date(Date.now() - 86_400_000).toISOString())
      .order('starts_at', { ascending: true })
      .limit(100),
  ]);

  const days: DayHours[] = Array.from({ length: 7 }, (_, dow) => {
    const row = (hours ?? []).find((h: { day_of_week: number }) => h.day_of_week === dow) as
      | { day_of_week: number; opens_at: string | null; closes_at: string | null; is_open: boolean }
      | undefined;
    return {
      dayOfWeek: dow,
      isOpen: row?.is_open ?? false,
      opensAt: (row?.opens_at ?? '08:00').slice(0, 5),
      closesAt: (row?.closes_at ?? '17:00').slice(0, 5),
    };
  });

  const slots: BlockedSlotItem[] = ((blocks ?? []) as {
    id: string;
    starts_at: string;
    ends_at: string;
    reason: string | null;
  }[]).map((b) => ({
    id: b.id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    reason: b.reason,
    label: `${fmtDate(b.starts_at)} · ${fmtTime(b.starts_at)} – ${fmtTime(b.ends_at)}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
          Availability
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Weekly opening hours plus one-off blocks. Booking slots respect both.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <BusinessHoursEditor initial={days} />
        <BlockedSlotsManager slots={slots} />
      </div>
    </div>
  );
}
