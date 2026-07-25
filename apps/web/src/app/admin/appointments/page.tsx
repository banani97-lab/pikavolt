import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '@pikavolt/core';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/admin/StatusBadge';
import {
  businessDayRange,
  fmtDate,
  fmtTime,
  STATUS_META,
} from '@/components/admin/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Appointments' };
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  status: AppointmentStatus;
  scheduled_start: string;
  scheduled_end: string;
  description: string | null;
  is_emergency: boolean;
  job_total_cents: number | null;
  customer: { full_name: string | null; phone: string | null } | null;
  address: { line1: string; city: string } | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

const TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  ...APPOINTMENT_STATUSES.map((s) => ({ key: s, label: STATUS_META[s].label })),
];

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === 'string' ? sp.status : 'all';
  const from = typeof sp.from === 'string' ? sp.from : '';
  const to = typeof sp.to === 'string' ? sp.to : '';
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';

  const supabase = await createClient();
  let query = supabase
    .from('appointments')
    .select(
      'id, status, scheduled_start, scheduled_end, description, is_emergency, job_total_cents, customer:profiles!appointments_customer_id_fkey(full_name, phone), address:addresses(line1, city)',
    )
    .order('scheduled_start', { ascending: false })
    .limit(300);

  if (status !== 'all' && (APPOINTMENT_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    query = query.gte('scheduled_start', businessDayRange(from).startIso);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    query = query.lt('scheduled_start', businessDayRange(to).endIso);
  }

  const { data } = await query;
  let rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...r,
    customer: one(r.customer as Row['customer']),
    address: one(r.address as Row['address']),
  })) as unknown as Row[];

  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) => (r.customer?.full_name ?? '').toLowerCase().includes(needle));
  }

  const hrefFor = (params: Record<string, string>) => {
    const merged = new URLSearchParams();
    const next = { status, from, to, q, ...params };
    for (const [k, v] of Object.entries(next)) {
      if (v && v !== 'all') merged.set(k, v);
    }
    const s = merged.toString();
    return s ? `/admin/appointments?${s}` : '/admin/appointments';
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
        Appointments
      </h1>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={hrefFor({ status: t.key })}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              status === t.key
                ? 'border-volt bg-volt/15 text-volt'
                : 'border-white/15 text-zinc-400 hover:border-white/30 hover:text-white',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Date range + search (GET form) */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-surface p-4"
      >
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
        <div>
          <label htmlFor="from" className="mb-1 block text-xs font-medium text-zinc-400">
            From
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={from}
            className="h-9 rounded-lg border border-white/15 bg-storm px-2 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <div>
          <label htmlFor="to" className="mb-1 block text-xs font-medium text-zinc-400">
            To
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={to}
            className="h-9 rounded-lg border border-white/15 bg-storm px-2 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-zinc-400">
            Customer name
          </label>
          <input
            id="q"
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search customers…"
            className="h-9 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-volt px-4 text-sm font-semibold text-storm hover:brightness-105"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Filter
        </button>
        {(from || to || q) && (
          <Link
            href={hrefFor({ from: '', to: '', q: '' })}
            className="h-9 content-center text-xs text-zinc-400 underline-offset-2 hover:text-white hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Results */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  No appointments match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="group transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/admin/appointments/${r.id}`} className="block">
                      <div className="font-semibold text-white group-hover:text-volt">
                        {fmtDate(r.scheduled_start)}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {fmtTime(r.scheduled_start)} – {fmtTime(r.scheduled_end)}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/appointments/${r.id}`} className="block">
                      <div className="flex items-center gap-2 text-white">
                        {r.customer?.full_name ?? '—'}
                        {r.is_emergency && (
                          <span className="rounded-full bg-emergency/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emergency">
                            ER
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">{r.customer?.phone ?? ''}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {r.address ? `${r.address.line1}, ${r.address.city}` : '—'}
                  </td>
                  <td className="max-w-64 truncate px-4 py-3 text-zinc-400">
                    {r.description ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-600">{rows.length} appointment(s)</p>
    </div>
  );
}
