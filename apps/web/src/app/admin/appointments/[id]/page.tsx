import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Wrench,
  CreditCard,
  History,
} from 'lucide-react';
import type { AppointmentStatus } from '@pikavolt/core';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AppointmentActions } from '@/components/admin/AppointmentActions';
import { RescheduleForm } from '@/components/admin/RescheduleForm';
import {
  addressText,
  fmtDate,
  fmtDateTime,
  fmtTime,
  fmtUSD,
  mapsUrl,
  STATUS_META,
  stripePaymentUrl,
} from '@/components/admin/format';

export const metadata: Metadata = { title: 'Appointment' };
export const dynamic = 'force-dynamic';

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminAppointmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('appointments')
    .select(
      `id, status, is_emergency, scheduled_start, scheduled_end, description, job_notes,
       service_call_fee_cents, job_total_cents, promo_code, discount_cents,
       auto_charge_consent, cancelled_reason, completed_at, created_at,
       customer:profiles!appointments_customer_id_fkey(id, full_name, phone, email),
       address:addresses(line1, line2, city, state, zip, property_type),
       services:appointment_services(custom_note, service:services(name)),
       payments(id, kind, amount_cents, status, stripe_payment_intent_id, paid_at, created_at),
       events:appointment_events(id, from_status, to_status, created_at)`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();

  const appt = data as Record<string, unknown>;
  const status = appt.status as AppointmentStatus;
  const customer = one(
    appt.customer as { id: string; full_name: string | null; phone: string | null; email: string | null } | null,
  );
  const address = one(
    appt.address as {
      line1: string;
      line2: string | null;
      city: string;
      state: string;
      zip: string;
      property_type: string;
    } | null,
  );
  const services = (appt.services ?? []) as {
    custom_note: string | null;
    service: { name: string } | { name: string }[] | null;
  }[];
  const payments = ((appt.payments ?? []) as {
    id: string;
    kind: string | null;
    amount_cents: number;
    status: string;
    stripe_payment_intent_id: string | null;
    paid_at: string | null;
    created_at: string;
  }[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const events = ((appt.events ?? []) as {
    id: string;
    from_status: AppointmentStatus | null;
    to_status: AppointmentStatus | null;
    created_at: string;
  }[]).sort((a, b) => b.created_at.localeCompare(a.created_at));

  const scheduledStart = appt.scheduled_start as string;
  const scheduledEnd = appt.scheduled_end as string;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/appointments"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-volt"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All appointments
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl uppercase tracking-wide text-white">
            {customer?.full_name ?? 'Appointment'}
          </h1>
          <StatusBadge status={status} />
          {Boolean(appt.is_emergency) && (
            <span className="rounded-full bg-emergency/15 px-2.5 py-0.5 text-xs font-bold uppercase text-emergency">
              Emergency
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          {fmtDate(scheduledStart)} · {fmtTime(scheduledStart)} – {fmtTime(scheduledEnd)}
        </p>
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-white/10 bg-surface p-4">
        <AppointmentActions appointmentId={id} status={status} />
        <div className="mt-4 border-t border-white/10 pt-4">
          <RescheduleForm appointmentId={id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Customer + address */}
        <section className="rounded-xl border border-white/10 bg-surface p-5">
          <h2 className="mb-3 font-display text-base uppercase tracking-wide text-white">
            Customer &amp; location
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Customer</dt>
              <dd className="mt-0.5 font-semibold text-white">
                {customer ? (
                  <Link href={`/admin/customers/${customer.id}`} className="hover:text-volt">
                    {customer.full_name ?? 'Unnamed'}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            {customer?.phone && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Phone</dt>
                <dd className="mt-0.5">
                  <a
                    href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-volt hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {customer.phone}
                  </a>
                </dd>
              </div>
            )}
            {customer?.email && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Email</dt>
                <dd className="mt-0.5">
                  <a
                    href={`mailto:${customer.email}`}
                    className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-volt"
                  >
                    <Mail className="h-3.5 w-3.5" /> {customer.email}
                  </a>
                </dd>
              </div>
            )}
            {address && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">
                  Address ({address.property_type})
                </dt>
                <dd className="mt-0.5">
                  <a
                    href={mapsUrl(address)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-1.5 text-zinc-200 hover:text-volt"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {addressText(address)}
                      <ExternalLink className="ml-1 inline h-3 w-3 text-zinc-500" />
                    </span>
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* Job details */}
        <section className="rounded-xl border border-white/10 bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base uppercase tracking-wide text-white">
            <Wrench className="h-4 w-4 text-volt" /> Job
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Requested services</dt>
              <dd className="mt-1">
                {services.length === 0 ? (
                  <span className="text-zinc-500">None selected</span>
                ) : (
                  <ul className="space-y-1">
                    {services.map((s, i) => {
                      const svc = one(s.service);
                      return (
                        <li key={i} className="text-zinc-200">
                          • {svc?.name ?? 'Service'}
                          {s.custom_note && (
                            <span className="text-zinc-500"> — {s.custom_note}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Description</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-zinc-300">
                {(appt.description as string) || '—'}
              </dd>
            </div>
            {Boolean(appt.job_notes) && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Job notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-zinc-300">
                  {appt.job_notes as string}
                </dd>
              </div>
            )}
            {Boolean(appt.cancelled_reason) && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-emergency/80">
                  Cancellation reason
                </dt>
                <dd className="mt-0.5 text-zinc-300">{appt.cancelled_reason as string}</dd>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Service call fee</dt>
                <dd className="mt-0.5 font-semibold text-white">
                  {fmtUSD(appt.service_call_fee_cents as number)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Job total</dt>
                <dd className="mt-0.5 font-semibold text-white">
                  {fmtUSD(appt.job_total_cents as number | null)}
                </dd>
              </div>
              {Boolean(appt.promo_code) && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Promo</dt>
                  <dd className="mt-0.5 text-volt">
                    {appt.promo_code as string} (−{fmtUSD(appt.discount_cents as number)})
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">Auto-charge consent</dt>
                <dd className="mt-0.5 text-zinc-300">
                  {appt.auto_charge_consent ? 'Yes' : 'No — use pay link'}
                </dd>
              </div>
            </div>
          </dl>
        </section>

        {/* Payments */}
        <section className="rounded-xl border border-white/10 bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base uppercase tracking-wide text-white">
            <CreditCard className="h-4 w-4 text-volt" /> Payments
          </h2>
          {payments.length === 0 ? (
            <p className="text-sm text-zinc-500">No payments yet.</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="font-semibold capitalize text-white">
                      {p.kind ?? 'payment'} · {fmtUSD(p.amount_cents)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {p.paid_at ? `Paid ${fmtDateTime(p.paid_at)}` : `Created ${fmtDateTime(p.created_at)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        p.status === 'succeeded'
                          ? 'text-xs font-semibold text-emerald-400'
                          : p.status === 'failed'
                            ? 'text-xs font-semibold text-emergency'
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

        {/* Timeline */}
        <section className="rounded-xl border border-white/10 bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base uppercase tracking-wide text-white">
            <History className="h-4 w-4 text-volt" /> Timeline
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">No events recorded.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-white/10 pl-4 text-sm">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    className={`absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full ${
                      e.to_status ? STATUS_META[e.to_status].dot : 'bg-zinc-500'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="text-zinc-200">
                    {e.from_status
                      ? `${STATUS_META[e.from_status].label} → ${e.to_status ? STATUS_META[e.to_status].label : '—'}`
                      : `Booked (${e.to_status ? STATUS_META[e.to_status].label : '—'})`}
                  </div>
                  <div className="text-xs text-zinc-500">{fmtDateTime(e.created_at)}</div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 border-t border-white/10 pt-3 text-xs text-zinc-600">
            Booked {fmtDateTime(appt.created_at as string)}
            {appt.completed_at ? ` · Completed ${fmtDateTime(appt.completed_at as string)}` : ''}
          </p>
        </section>
      </div>
    </div>
  );
}
