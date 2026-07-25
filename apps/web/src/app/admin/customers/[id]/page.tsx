import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, Mail, MapPin, ExternalLink } from 'lucide-react';
import type { AppointmentStatus } from '@pikavolt/core';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/admin/StatusBadge';
import {
  addressText,
  fmtDate,
  fmtDateTime,
  fmtTime,
  fmtUSD,
  mapsUrl,
  stripePaymentUrl,
} from '@/components/admin/format';

export const metadata: Metadata = { title: 'Customer' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: addresses }, { data: appts }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, created_at, marketing_opt_in, stripe_customer_id')
      .eq('id', id)
      .eq('role', 'customer')
      .maybeSingle(),
    supabase
      .from('addresses')
      .select('id, label, line1, line2, city, state, zip, property_type, is_default')
      .eq('user_id', id),
    supabase
      .from('appointments')
      .select(
        'id, status, scheduled_start, scheduled_end, description, job_total_cents, payments(id, kind, amount_cents, status, stripe_payment_intent_id, paid_at)',
      )
      .eq('customer_id', id)
      .order('scheduled_start', { ascending: false }),
  ]);

  if (!profile) notFound();

  const appointments = (appts ?? []) as {
    id: string;
    status: AppointmentStatus;
    scheduled_start: string;
    scheduled_end: string;
    description: string | null;
    job_total_cents: number | null;
    payments: {
      id: string;
      kind: string | null;
      amount_cents: number;
      status: string;
      stripe_payment_intent_id: string | null;
      paid_at: string | null;
    }[];
  }[];

  const allPayments = appointments
    .flatMap((a) => a.payments.map((p) => ({ ...p, appointmentId: a.id })))
    .sort((a, b) => (b.paid_at ?? '').localeCompare(a.paid_at ?? ''));

  const lifetime = allPayments
    .filter((p) => p.status === 'succeeded')
    .reduce((s, p) => s + p.amount_cents, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/customers"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-volt"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All customers
        </Link>
        <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
          {profile.full_name ?? 'Unnamed customer'}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Customer since {fmtDate(profile.created_at)} · Lifetime revenue{' '}
          <span className="font-semibold text-emerald-400">{fmtUSD(lifetime)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contact */}
        <section className="rounded-xl border border-white/10 bg-surface p-5">
          <h2 className="mb-3 font-display text-base uppercase tracking-wide text-white">
            Contact
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Phone</dt>
              <dd className="mt-0.5">
                {profile.phone ? (
                  <a
                    href={`tel:${String(profile.phone).replace(/[^\d+]/g, '')}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-volt hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {profile.phone}
                  </a>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Email</dt>
              <dd className="mt-0.5">
                {profile.email ? (
                  <a
                    href={`mailto:${profile.email}`}
                    className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-volt"
                  >
                    <Mail className="h-3.5 w-3.5" /> {profile.email}
                  </a>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Marketing opt-in</dt>
              <dd className="mt-0.5 text-zinc-300">{profile.marketing_opt_in ? 'Yes' : 'No'}</dd>
            </div>
          </dl>

          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Addresses
          </h3>
          {(addresses ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500">No addresses on file.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(addresses ?? []).map(
                (a: {
                  id: string;
                  label: string | null;
                  line1: string;
                  line2: string | null;
                  city: string;
                  state: string;
                  zip: string;
                  property_type: string;
                  is_default: boolean;
                }) => (
                  <li key={a.id}>
                    <a
                      href={mapsUrl(a)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-start gap-1.5 text-zinc-200 hover:text-volt"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {a.label && <span className="font-semibold">{a.label}: </span>}
                        {addressText(a)}
                        <span className="ml-1 text-xs text-zinc-500">({a.property_type})</span>
                        {a.is_default && <span className="ml-1 text-xs text-volt">default</span>}
                      </span>
                    </a>
                  </li>
                ),
              )}
            </ul>
          )}
        </section>

        {/* Payments */}
        <section className="rounded-xl border border-white/10 bg-surface p-5">
          <h2 className="mb-3 font-display text-base uppercase tracking-wide text-white">
            Payments
          </h2>
          {allPayments.length === 0 ? (
            <p className="text-sm text-zinc-500">No payments.</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {allPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="font-semibold capitalize text-white">
                      {p.kind ?? 'payment'} · {fmtUSD(p.amount_cents)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {p.paid_at ? fmtDateTime(p.paid_at) : 'Not paid yet'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        p.status === 'succeeded'
                          ? 'text-xs font-semibold text-emerald-400'
                          : 'text-xs font-semibold text-zinc-400'
                      }
                    >
                      {p.status}
                    </span>
                    {p.stripe_payment_intent_id && (
                      <a
                        href={stripePaymentUrl(p.stripe_payment_intent_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-500 hover:text-volt"
                        aria-label="Open in Stripe"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Appointment history */}
      <section>
        <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-white">
          Appointment history
        </h2>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Job total</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    No appointments.
                  </td>
                </tr>
              ) : (
                appointments.map((a) => (
                  <tr key={a.id} className="group transition-colors hover:bg-white/[0.03]">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/admin/appointments/${a.id}`} className="block">
                        <div className="font-semibold text-white group-hover:text-volt">
                          {fmtDate(a.scheduled_start)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {fmtTime(a.scheduled_start)} – {fmtTime(a.scheduled_end)}
                        </div>
                      </Link>
                    </td>
                    <td className="max-w-72 truncate px-4 py-3 text-zinc-400">
                      {a.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">
                      {fmtUSD(a.job_total_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
