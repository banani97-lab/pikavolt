import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { AppointmentStatus } from '@pikavolt/core';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/admin/StatusBadge';
import {
  businessDay,
  businessDayRange,
  fmtTime,
  STATUS_META,
} from '@/components/admin/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

interface ApptRow {
  id: string;
  status: AppointmentStatus;
  scheduled_start: string;
  scheduled_end: string;
  description: string | null;
  customer: { full_name: string | null } | null;
}

interface BlockRow {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = businessDay();
  const monthStr =
    typeof sp.month === 'string' && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : today.slice(0, 7);
  const selectedDay =
    typeof sp.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null;

  // Pure calendar-date math (day strings) — timezone-independent.
  const monthDate = parse(`${monthStr}-01`, 'yyyy-MM-dd', new Date());
  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });

  const days: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    days.push(format(d, 'yyyy-MM-dd'));
  }

  const firstDay = days[0] ?? format(gridStart, 'yyyy-MM-dd');
  const lastDay = days[days.length - 1] ?? format(gridEnd, 'yyyy-MM-dd');
  const rangeStartIso = businessDayRange(firstDay).startIso;
  const rangeEndIso = businessDayRange(lastDay).endIso;

  const supabase = await createClient();
  const [{ data: apptsData }, { data: blocksData }] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        'id, status, scheduled_start, scheduled_end, description, customer:profiles!appointments_customer_id_fkey(full_name)',
      )
      .gte('scheduled_start', rangeStartIso)
      .lt('scheduled_start', rangeEndIso)
      .order('scheduled_start', { ascending: true }),
    supabase
      .from('blocked_slots')
      .select('id, starts_at, ends_at, reason')
      .lt('starts_at', rangeEndIso)
      .gt('ends_at', rangeStartIso),
  ]);

  const appts = ((apptsData ?? []) as Record<string, unknown>[]).map((a) => ({
    ...a,
    customer: one(a.customer as ApptRow['customer']),
  })) as unknown as ApptRow[];
  const blocks = (blocksData ?? []) as BlockRow[];

  const apptsByDay = new Map<string, ApptRow[]>();
  for (const a of appts) {
    const day = businessDay(new Date(a.scheduled_start));
    apptsByDay.set(day, [...(apptsByDay.get(day) ?? []), a]);
  }
  const blocksByDay = new Map<string, BlockRow[]>();
  for (const b of blocks) {
    const day = businessDay(new Date(b.starts_at));
    blocksByDay.set(day, [...(blocksByDay.get(day) ?? []), b]);
  }

  const prevMonth = format(addMonths(monthDate, -1), 'yyyy-MM');
  const nextMonth = format(addMonths(monthDate, 1), 'yyyy-MM');
  const dayAppts = selectedDay ? (apptsByDay.get(selectedDay) ?? []) : [];
  const dayBlocks = selectedDay ? (blocksByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
          Calendar
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/calendar?month=${prevMonth}`}
            aria-label="Previous month"
            className="rounded-lg border border-white/15 p-2 text-zinc-300 hover:border-volt/60 hover:text-volt"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="w-40 text-center font-display text-lg uppercase tracking-wide text-white">
            {format(monthDate, 'MMMM yyyy')}
          </div>
          <Link
            href={`/admin/calendar?month=${nextMonth}`}
            aria-label="Next month"
            className="rounded-lg border border-white/15 p-2 text-zinc-300 hover:border-volt/60 hover:text-volt"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/admin/calendar?month=${today.slice(0, 7)}&day=${today}`}
            className="ml-2 rounded-lg border border-volt/40 px-3 py-1.5 text-xs font-semibold text-volt hover:bg-volt/10"
          >
            Today
          </Link>
        </div>
      </div>

      {/* Month grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[820px] overflow-hidden rounded-xl border border-white/10 bg-surface">
          <div className="grid grid-cols-7 border-b border-white/10 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const inMonth = day.slice(0, 7) === monthStr;
              const isToday = day === today;
              const isSelected = day === selectedDay;
              const list = apptsByDay.get(day) ?? [];
              const blocked = blocksByDay.get(day) ?? [];
              return (
                <Link
                  key={day}
                  href={`/admin/calendar?month=${monthStr}&day=${day}`}
                  className={cn(
                    'flex min-h-28 flex-col gap-1 border-b border-r border-white/5 p-1.5 transition-colors hover:bg-white/[0.04]',
                    !inMonth && 'bg-storm/60 opacity-50',
                    isSelected && 'bg-volt/[0.06] ring-1 ring-inset ring-volt/50',
                  )}
                >
                  <span
                    className={cn(
                      'self-end rounded-full px-1.5 text-xs font-semibold',
                      isToday ? 'bg-volt text-storm' : 'text-zinc-500',
                    )}
                  >
                    {Number(day.slice(8, 10))}
                  </span>
                  {list.slice(0, 3).map((a) => (
                    <span
                      key={a.id}
                      className={cn(
                        'flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight',
                        STATUS_META[a.status].badge,
                      )}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_META[a.status].dot)}
                      />
                      {fmtTime(a.scheduled_start)} {a.customer?.full_name ?? ''}
                    </span>
                  ))}
                  {blocked.slice(0, 2).map((b) => (
                    <span
                      key={b.id}
                      className="flex items-center gap-1 truncate rounded bg-white/5 px-1 py-0.5 text-[10px] font-medium text-zinc-400"
                    >
                      <Ban className="h-2.5 w-2.5 shrink-0" />
                      {b.reason ?? 'Blocked'}
                    </span>
                  ))}
                  {list.length > 3 && (
                    <span className="text-[10px] text-zinc-500">+{list.length - 3} more</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day detail */}
      {selectedDay && (
        <section className="rounded-xl border border-white/10 bg-surface p-5">
          <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-white">
            {format(parse(selectedDay, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d')}
          </h2>
          {dayAppts.length === 0 && dayBlocks.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {dayBlocks.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-storm/50 px-4 py-2.5 text-sm text-zinc-400"
                >
                  <Ban className="h-4 w-4 shrink-0" />
                  {fmtTime(b.starts_at)} – {fmtTime(b.ends_at)} · {b.reason ?? 'Blocked'}
                </li>
              ))}
              {dayAppts.map((a) => (
                <li key={a.id}>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-storm/50 px-4 py-2.5">
                    <span className="w-36 text-sm font-semibold text-white">
                      {fmtTime(a.scheduled_start)} – {fmtTime(a.scheduled_end)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                      {a.customer?.full_name ?? 'Customer'}
                      {a.description ? ` · ${a.description}` : ''}
                    </span>
                    <StatusBadge status={a.status} />
                    <Link
                      href={`/admin/appointments/${a.id}`}
                      className="text-xs font-semibold text-volt hover:underline"
                    >
                      Open / reschedule
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
