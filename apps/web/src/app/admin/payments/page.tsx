import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fmtDateTime, fmtUSD, stripePaymentUrl } from '@/components/admin/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

const STATUSES = ['all', 'pending', 'processing', 'succeeded', 'failed', 'refunded'] as const;

interface PaymentRow {
  id: string;
  kind: string | null;
  amount_cents: number;
  status: string;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  appointment: {
    id: string;
    scheduled_start: string;
    customer: { id: string; full_name: string | null } | null;
  } | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

const statusText: Record<string, string> = {
  succeeded: 'text-emerald-400',
  failed: 'text-emergency',
  refunded: 'text-arc-end',
  processing: 'text-orange-300',
  pending: 'text-zinc-400',
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status =
    typeof sp.status === 'string' && (STATUSES as readonly string[]).includes(sp.status)
      ? sp.status
      : 'all';

  const supabase = await createClient();
  let query = supabase
    .from('payments')
    .select(
      'id, kind, amount_cents, status, stripe_payment_intent_id, paid_at, created_at, appointment:appointments(id, scheduled_start, customer:profiles!appointments_customer_id_fkey(id, full_name))',
    )
    .order('created_at', { ascending: false })
    .limit(300);
  if (status !== 'all') query = query.eq('status', status);

  const { data } = await query;
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const appt = one(r.appointment as PaymentRow['appointment']);
    return {
      ...r,
      appointment: appt ? { ...appt, customer: one(appt.customer) } : null,
    };
  }) as unknown as PaymentRow[];

  const total = rows.reduce((s, r) => s + r.amount_cents, 0);
  const totalSucceeded = rows
    .filter((r) => r.status === 'succeeded')
    .reduce((s, r) => s + r.amount_cents, 0);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
        Payments
      </h1>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === 'all' ? '/admin/payments' : `/admin/payments?status=${s}`}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors',
              status === s
                ? 'border-volt bg-volt/15 text-volt'
                : 'border-white/15 text-zinc-400 hover:border-white/30 hover:text-white',
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Stripe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  No payments.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-300">
                    {fmtDateTime(r.paid_at ?? r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {r.appointment?.customer ? (
                      <Link
                        href={`/admin/appointments/${r.appointment.id}`}
                        className="font-semibold text-white hover:text-volt"
                      >
                        {r.appointment.customer.full_name ?? 'Customer'}
                      </Link>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-400">{r.kind ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    {fmtUSD(r.amount_cents)}
                  </td>
                  <td className={cn('px-4 py-3 font-semibold', statusText[r.status] ?? 'text-zinc-400')}>
                    {r.status}
                  </td>
                  <td className="px-4 py-3">
                    {r.stripe_payment_intent_id ? (
                      <a
                        href={stripePaymentUrl(r.stripe_payment_intent_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-volt"
                      >
                        {r.stripe_payment_intent_id.slice(0, 18)}…
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-white/10 text-sm">
                <td colSpan={3} className="px-4 py-3 font-semibold text-zinc-400">
                  Totals ({rows.length} payment{rows.length === 1 ? '' : 's'})
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="font-bold text-white">{fmtUSD(total)}</div>
                  <div className="text-xs text-emerald-400">
                    {fmtUSD(totalSucceeded)} succeeded
                  </div>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
