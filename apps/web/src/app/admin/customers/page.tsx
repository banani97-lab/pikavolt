import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, fmtUSD } from '@/components/admin/format';

export const metadata: Metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

interface CustomerRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';

  const supabase = await createClient();
  const [{ data: customersData }, { data: apptsData }, { data: paymentsData }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, phone, created_at')
        .eq('role', 'customer')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('appointments').select('id, customer_id, status'),
      supabase
        .from('payments')
        .select('amount_cents, status, appointment:appointments(customer_id)')
        .eq('status', 'succeeded'),
    ]);

  let customers = (customersData ?? []) as CustomerRow[];
  if (q) {
    const needle = q.toLowerCase();
    customers = customers.filter(
      (c) =>
        (c.full_name ?? '').toLowerCase().includes(needle) ||
        (c.email ?? '').toLowerCase().includes(needle),
    );
  }

  const apptCounts = new Map<string, number>();
  for (const a of (apptsData ?? []) as { customer_id: string }[]) {
    apptCounts.set(a.customer_id, (apptCounts.get(a.customer_id) ?? 0) + 1);
  }

  const revenue = new Map<string, number>();
  for (const p of (paymentsData ?? []) as {
    amount_cents: number;
    appointment: { customer_id: string } | { customer_id: string }[] | null;
  }[]) {
    const appt = Array.isArray(p.appointment) ? p.appointment[0] : p.appointment;
    if (!appt) continue;
    revenue.set(appt.customer_id, (revenue.get(appt.customer_id) ?? 0) + p.amount_cents);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
        Customers
      </h1>

      <form method="get" className="flex max-w-md items-center gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name or email…"
          className="h-10 w-full rounded-lg border border-white/15 bg-surface px-3 text-sm text-white placeholder:text-zinc-600"
          aria-label="Search customers"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-volt px-4 text-sm font-semibold text-storm hover:brightness-105"
        >
          <Search className="h-4 w-4" /> Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Since</th>
              <th className="px-4 py-3 text-right font-medium">Appointments</th>
              <th className="px-4 py-3 text-right font-medium">Lifetime revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  No customers found.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-semibold text-white group-hover:text-volt"
                    >
                      {c.full_name ?? 'Unnamed'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    <div>{c.email ?? '—'}</div>
                    <div className="text-xs text-zinc-500">{c.phone ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{fmtDate(c.created_at)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    {apptCounts.get(c.id) ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                    {fmtUSD(revenue.get(c.id) ?? 0)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-600">{customers.length} customer(s)</p>
    </div>
  );
}
