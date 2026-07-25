import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CalendarDays,
  CircleDollarSign,
  Hourglass,
  MessageSquare,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { addDays, startOfWeek } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { computeFinal, SERVICE_CALL_FEE_CENTS, type AppointmentStatus } from '@pikavolt/core';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/admin/StatusBadge';
import {
  BUSINESS_TZ,
  businessDay,
  businessDayRange,
  fmtTime,
  fmtUSD,
  fmtDateTime,
  STATUS_META,
} from '@/components/admin/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

interface TodayAppt {
  id: string;
  status: AppointmentStatus;
  scheduled_start: string;
  scheduled_end: string;
  description: string | null;
  is_emergency: boolean;
  customer: { full_name: string | null } | null;
  address: { line1: string; city: string } | null;
}

interface EventRow {
  id: string;
  created_at: string;
  from_status: AppointmentStatus | null;
  to_status: AppointmentStatus | null;
  appointment: {
    id: string;
    customer: { full_name: string | null } | null;
  } | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const today = businessDay();
  const { startIso: dayStart, endIso: dayEnd } = businessDayRange(today);

  const weekStartDay = formatInTimeZone(
    startOfWeek(fromZonedTime(`${today}T12:00:00`, BUSINESS_TZ), { weekStartsOn: 1 }),
    BUSINESS_TZ,
    'yyyy-MM-dd',
  );
  const weekStartIso = businessDayRange(weekStartDay).startIso;
  const weekEndIso = fromZonedTime(
    `${formatInTimeZone(addDays(new Date(weekStartIso), 7), BUSINESS_TZ, 'yyyy-MM-dd')}T00:00:00`,
    BUSINESS_TZ,
  ).toISOString();

  const monthStartIso = fromZonedTime(
    `${today.slice(0, 7)}-01T00:00:00`,
    BUSINESS_TZ,
  ).toISOString();

  const [
    { data: todayAppts },
    { count: weekJobs },
    { data: monthPayments },
    { data: completedAppts },
    { data: allPayments },
    { data: unreadConvs },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        'id, status, scheduled_start, scheduled_end, description, is_emergency, customer:profiles!appointments_customer_id_fkey(full_name), address:addresses(line1, city)',
      )
      .gte('scheduled_start', dayStart)
      .lt('scheduled_start', dayEnd)
      .order('scheduled_start', { ascending: true }),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_start', weekStartIso)
      .lt('scheduled_start', weekEndIso)
      .not('status', 'in', '(cancelled,no_show)'),
    supabase
      .from('payments')
      .select('amount_cents')
      .eq('status', 'succeeded')
      .gte('paid_at', monthStartIso),
    supabase
      .from('appointments')
      .select('id, job_total_cents, discount_cents')
      .eq('status', 'completed'),
    supabase.from('payments').select('appointment_id, kind, status, amount_cents'),
    supabase.from('conversations').select('id').gt('owner_unread', 0),
    supabase
      .from('appointment_events')
      .select(
        'id, created_at, from_status, to_status, appointment:appointments(id, customer:profiles!appointments_customer_id_fkey(full_name))',
      )
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  const revenueMonth = (monthPayments ?? []).reduce(
    (sum: number, p: { amount_cents: number }) => sum + p.amount_cents,
    0,
  );

  // Pending finals: completed appointments without a succeeded final payment.
  const paymentsByAppt = new Map<
    string,
    { kind: string | null; status: string; amount_cents: number }[]
  >();
  for (const p of (allPayments ?? []) as {
    appointment_id: string;
    kind: string | null;
    status: string;
    amount_cents: number;
  }[]) {
    const list = paymentsByAppt.get(p.appointment_id) ?? [];
    list.push(p);
    paymentsByAppt.set(p.appointment_id, list);
  }

  let pendingFinalCount = 0;
  let pendingFinalCents = 0;
  for (const a of (completedAppts ?? []) as {
    id: string;
    job_total_cents: number | null;
    discount_cents: number;
  }[]) {
    const pays = paymentsByAppt.get(a.id) ?? [];
    const hasFinal = pays.some((p) => p.kind === 'final' && p.status === 'succeeded');
    if (hasFinal) continue;
    pendingFinalCount += 1;
    const depositPaid = pays
      .filter((p) => p.kind === 'deposit' && p.status === 'succeeded')
      .reduce((s, p) => s + p.amount_cents, 0);
    if (a.job_total_cents && a.job_total_cents >= SERVICE_CALL_FEE_CENTS) {
      try {
        pendingFinalCents += computeFinal(a.job_total_cents, a.discount_cents, depositPaid);
      } catch {
        /* skip malformed rows */
      }
    }
  }

  const stats = [
    {
      label: 'Jobs this week',
      value: String(weekJobs ?? 0),
      icon: CalendarDays,
      accent: 'text-volt',
    },
    {
      label: 'Collected this month',
      value: fmtUSD(revenueMonth),
      icon: CircleDollarSign,
      accent: 'text-emerald-400',
    },
    {
      label: 'Pending final payments',
      value: `${pendingFinalCount} · ${fmtUSD(pendingFinalCents)}`,
      icon: Hourglass,
      accent: 'text-orange-400',
    },
    {
      label: 'Unread chats',
      value: String((unreadConvs ?? []).length),
      icon: MessageSquare,
      accent: 'text-arc-end',
    },
  ];

  const appts = (todayAppts ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    customer: one(a.customer as TodayAppt['customer']),
    address: one(a.address as TodayAppt['address']),
  })) as unknown as TodayAppt[];

  const feed = (events ?? []).map((e: Record<string, unknown>) => {
    const appt = one(e.appointment as EventRow['appointment']);
    return {
      ...e,
      appointment: appt ? { ...appt, customer: one(appt.customer) } : null,
    };
  }) as unknown as EventRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {formatInTimeZone(new Date(), BUSINESS_TZ, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-white/10 bg-surface p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <Icon className={cn('h-4 w-4', s.accent)} aria-hidden="true" />
                {s.label}
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Today's appointments */}
        <section className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-white">
              Today&rsquo;s appointments
            </h2>
            <Link
              href="/admin/appointments"
              className="inline-flex items-center gap-1 text-xs font-semibold text-volt hover:underline"
            >
              All appointments <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {appts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-surface/50 p-8 text-center text-sm text-zinc-500">
              Nothing on the schedule today.
            </div>
          ) : (
            <ul className="space-y-3">
              {appts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/appointments/${a.id}`}
                    className="flex items-center gap-4 rounded-xl border border-white/10 bg-surface p-4 transition-colors hover:border-volt/40"
                  >
                    <div className="w-24 shrink-0 border-r border-white/10 pr-4">
                      <div className="text-sm font-bold text-white">
                        {fmtTime(a.scheduled_start)}
                      </div>
                      <div className="text-xs text-zinc-500">→ {fmtTime(a.scheduled_end)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-white">
                          {a.customer?.full_name ?? 'Customer'}
                        </span>
                        {a.is_emergency && (
                          <span className="rounded-full bg-emergency/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emergency">
                            Emergency
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-zinc-400">
                        {a.address ? `${a.address.line1}, ${a.address.city}` : '—'}
                        {a.description ? ` · ${a.description}` : ''}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg uppercase tracking-wide text-white">
            <Activity className="h-4 w-4 text-volt" aria-hidden="true" />
            Recent activity
          </h2>
          <div className="rounded-xl border border-white/10 bg-surface">
            {feed.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">No activity yet.</div>
            ) : (
              <ul className="divide-y divide-white/5">
                {feed.map((e) => (
                  <li key={e.id} className="px-4 py-3 text-sm">
                    <Link
                      href={
                        e.appointment
                          ? `/admin/appointments/${e.appointment.id}`
                          : '/admin/appointments'
                      }
                      className="group block"
                    >
                      <div className="text-zinc-300">
                        <span className="font-semibold text-white group-hover:text-volt">
                          {e.appointment?.customer?.full_name ?? 'Customer'}
                        </span>{' '}
                        {e.from_status ? (
                          <span className="text-zinc-400">
                            {STATUS_META[e.from_status].label} →{' '}
                            <span className="text-zinc-200">
                              {e.to_status ? STATUS_META[e.to_status].label : '—'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-400">
                            booked · {e.to_status ? STATUS_META[e.to_status].label : '—'}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500">
                        {fmtDateTime(e.created_at)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
