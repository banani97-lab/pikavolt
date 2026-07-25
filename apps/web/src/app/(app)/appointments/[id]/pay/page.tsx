import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/server';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { PayFinalForm } from '@/components/appointments/PayFinalForm';
import { formatApptStart, formatCents } from '@/components/booking/format';

export const metadata: Metadata = { title: 'Pay Balance' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AppointmentPayPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/appointments/${id}/pay`);

  // RLS scopes this to the customer's own appointment.
  const { data: appt } = await supabase
    .from('appointments')
    .select('id, status, scheduled_start')
    .eq('id', id)
    .maybeSingle();
  if (!appt) notFound();

  const { data: payments } = await supabase
    .from('payments')
    .select('id, kind, amount_cents, status, stripe_payment_intent_id, created_at')
    .eq('appointment_id', id)
    .eq('kind', 'final')
    .order('created_at', { ascending: false });

  const paid = (payments ?? []).find((p) => p.status === 'succeeded');
  const payable = (payments ?? []).find(
    (p) => (p.status === 'pending' || p.status === 'processing') && p.stripe_payment_intent_id,
  );

  let clientSecret: string | null = null;
  let amountCents = payable?.amount_cents ?? 0;
  if (payable?.stripe_payment_intent_id && isStripeConfigured()) {
    const pi = await getStripe().paymentIntents.retrieve(payable.stripe_payment_intent_id);
    if (
      ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)
    ) {
      clientSecret = pi.client_secret;
      amountCents = pi.amount;
    } else if (pi.status === 'succeeded') {
      clientSecret = null;
    }
  }

  return (
    <Container className="max-w-xl py-12">
      <Link
        href={`/appointments/${id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-volt"
      >
        <ArrowLeft className="h-4 w-4" /> Back to appointment
      </Link>

      <h1 className="mb-2 font-display text-3xl uppercase tracking-wide text-white">
        Pay <span className="text-volt">Balance</span>
      </h1>
      <p className="mb-8 text-sm text-zinc-400">
        Service call on {formatApptStart(appt.scheduled_start)}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>
            {clientSecret ? `Amount due: ${formatCents(amountCents)}` : 'Balance'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paid && !clientSecret ? (
            <p className="text-sm text-volt">
              Your final payment of {formatCents(paid.amount_cents)} is already in — thank you!
            </p>
          ) : clientSecret ? (
            <PayFinalForm appointmentId={id} clientSecret={clientSecret} amountCents={amountCents} />
          ) : (
            <p className="text-sm text-zinc-400">
              Nothing is due right now. When your job wraps up you&apos;ll get a payment link here.
            </p>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
