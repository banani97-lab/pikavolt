import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CreditCard, FileText, MapPin, Wrench } from 'lucide-react';
import type { AppointmentStatus } from '@pikavolt/core';
import { Container } from '@/components/ui/Container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/server';
import { getBookingSettings } from '@/lib/appointments';
import { StatusBadge } from '@/components/appointments/StatusBadge';
import { StatusTimeline, type TimelineEvent } from '@/components/appointments/StatusTimeline';
import { PaymentSummary, type PaymentRow } from '@/components/appointments/PaymentSummary';
import { CancelAppointmentButton } from '@/components/appointments/CancelAppointmentButton';
import { TrackingSection } from '@/components/tracking/TrackingSection';
import { formatApptStart, formatCents, formatSlotRange } from '@/components/booking/format';

export const metadata: Metadata = { title: 'Appointment' };

interface PageProps {
  params: Promise<{ id: string }>;
}

interface RawDetail {
  id: string;
  status: AppointmentStatus;
  scheduled_start: string;
  scheduled_end: string;
  description: string | null;
  service_call_fee_cents: number;
  discount_cents: number;
  job_total_cents: number | null;
  promo_code: string | null;
  auto_charge_consent: boolean;
  addresses: {
    label: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    zip: string;
  } | null;
  appointment_services: Array<{ services: { name: string } | null }>;
}

export default async function AppointmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/appointments/${id}`);

  const [{ data: apptRaw }, { data: eventsRaw }, { data: paymentsRaw }, settings] =
    await Promise.all([
      supabase
        .from('appointments')
        .select(
          `id, status, scheduled_start, scheduled_end, description, service_call_fee_cents,
           discount_cents, job_total_cents, promo_code, auto_charge_consent,
           addresses:address_id ( label, line1, line2, city, state, zip ),
           appointment_services ( services ( name ) )`,
        )
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('appointment_events')
        .select('id, to_status, created_at')
        .eq('appointment_id', id)
        .order('created_at'),
      supabase
        .from('payments')
        .select('id, kind, amount_cents, status, paid_at')
        .eq('appointment_id', id)
        .order('created_at'),
      getBookingSettings(),
    ]);

  if (!apptRaw) notFound();
  const appt = apptRaw as unknown as RawDetail;
  const events = (eventsRaw ?? []) as TimelineEvent[];
  const payments = (paymentsRaw ?? []) as PaymentRow[];

  const serviceNames = (appt.appointment_services ?? [])
    .map((s) => s.services?.name)
    .filter((n): n is string => !!n);
  const addressLine = appt.addresses
    ? [appt.addresses.line1, appt.addresses.line2, `${appt.addresses.city}, ${appt.addresses.state} ${appt.addresses.zip}`]
        .filter(Boolean)
        .join(', ')
    : '';

  const depositPaid = payments.find((p) => p.kind === 'deposit' && p.status === 'succeeded');
  const pendingFinal = payments.find(
    (p) => p.kind === 'final' && (p.status === 'pending' || p.status === 'failed'),
  );
  const cancellable = appt.status === 'requested' || appt.status === 'confirmed';
  const showTracking = ['confirmed', 'en_route', 'in_progress'].includes(appt.status);

  return (
    <Container className="py-12">
      <Link
        href="/appointments"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-volt"
      >
        <ArrowLeft className="h-4 w-4" /> All appointments
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
          {formatApptStart(appt.scheduled_start)}
        </h1>
        <StatusBadge status={appt.status} />
      </div>

      {pendingFinal && appt.status !== 'closed' && (
        <Link
          href={`/appointments/${appt.id}/pay`}
          className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-volt/50 bg-volt/10 p-5 transition-all hover:shadow-volt-glow"
        >
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-volt" />
            <div>
              <p className="font-semibold text-white">Final payment due</p>
              <p className="text-sm text-zinc-400">
                {formatCents(pendingFinal.amount_cents)} remaining — pay securely online.
              </p>
            </div>
          </div>
          <span className="rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-storm">
            Pay now
          </span>
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline currentStatus={appt.status} events={events} />
            </CardContent>
          </Card>

          {showTracking && <TrackingSection appointmentId={appt.id} />}

          {cancellable && (
            <CancelAppointmentButton
              appointmentId={appt.id}
              scheduledStart={appt.scheduled_start}
              depositPaidCents={depositPaid?.amount_cents ?? 0}
              cancellationWindowHours={settings.cancellationWindowHours}
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-volt" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Services</p>
                  <p className="text-sm text-white">
                    {serviceNames.length ? serviceNames.join(', ') : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-volt" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Address</p>
                  <p className="text-sm text-white">{addressLine || '—'}</p>
                </div>
              </div>
              {appt.description && (
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-volt" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Job description</p>
                    <p className="text-sm text-zinc-300">{appt.description}</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-zinc-500">
                Window: {formatSlotRange(appt.scheduled_start, appt.scheduled_end)} ET
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentSummary
                payments={payments}
                serviceCallFeeCents={appt.service_call_fee_cents}
                discountCents={appt.discount_cents}
                jobTotalCents={appt.job_total_cents}
              />
              {appt.promo_code && (
                <p className="mt-3 text-xs text-zinc-500">Promo applied: {appt.promo_code}</p>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                {appt.auto_charge_consent
                  ? 'Final balance will be auto-charged to your saved card when the job completes.'
                  : 'You’ll receive a secure payment link for the final balance.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
