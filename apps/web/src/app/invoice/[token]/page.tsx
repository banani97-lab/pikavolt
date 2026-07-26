import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CheckCircle2, Zap } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { formatMoney } from '@/lib/appointments';
import { InvoicePayForm } from './InvoicePayForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pay your invoice — Pikavolt LLC',
  robots: { index: false },
};

export default async function InvoicePayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: appt } = await admin
    .from('appointments')
    .select('id, description, is_invoice, status')
    .eq('invoice_token', token)
    .maybeSingle();
  if (!appt || !appt.is_invoice) notFound();

  const { data: payments } = await admin
    .from('payments')
    .select('kind, amount_cents, status, stripe_payment_intent_id, created_at')
    .eq('appointment_id', appt.id)
    .order('created_at', { ascending: false });
  const rows = payments ?? [];

  const paidAny = rows.some((p) => p.status === 'succeeded');
  const payable = rows.find(
    (p) => ['pending', 'processing'].includes(p.status) && p.stripe_payment_intent_id,
  );

  let clientSecret: string | null = null;
  let amountCents = 0;
  if (payable && isStripeConfigured()) {
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(payable.stripe_payment_intent_id as string);
    if (
      ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status)
    ) {
      clientSecret = pi.client_secret;
      amountCents = pi.amount;
    }
  }

  const isFinal = payable?.kind === 'final';

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <div className="mb-6 flex items-center gap-2">
        <Zap className="h-6 w-6 text-volt" aria-hidden="true" />
        <span className="font-display text-xl uppercase tracking-wide text-snow">Pikavolt LLC</span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-surface p-6 sm:p-8">
        {clientSecret ? (
          <>
            <h1 className="font-display text-2xl uppercase tracking-wide text-snow">
              {isFinal ? 'Balance Due' : 'Pay Your Invoice'}
            </h1>
            {appt.description && (
              <p className="mt-2 text-sm text-muted">{appt.description}</p>
            )}
            <p className="mt-4 text-3xl font-bold text-volt">{formatMoney(amountCents)}</p>
            <p className="mt-1 text-xs text-muted">
              Secure payment by Stripe. Pikavolt never sees your card details.
            </p>
            <div className="mt-6">
              <InvoicePayForm
                token={token}
                clientSecret={clientSecret}
                amountCents={amountCents}
              />
            </div>
          </>
        ) : paidAny ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-volt" aria-hidden="true" />
            <h1 className="mt-4 font-display text-2xl uppercase tracking-wide text-snow">
              Payment Received
            </h1>
            <p className="mt-2 text-sm text-muted">
              Thanks! There&apos;s nothing due right now. If a balance is owed on completion,
              we&apos;ll send you a new link.
            </p>
          </div>
        ) : (
          <div className="py-6 text-center">
            <h1 className="font-display text-2xl uppercase tracking-wide text-snow">
              Nothing Due
            </h1>
            <p className="mt-2 text-sm text-muted">
              This invoice has no payment due at the moment.
            </p>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Questions? Contact Pikavolt LLC at{' '}
        <a href="mailto:support@pikavolt.net" className="text-arc hover:text-volt">
          support@pikavolt.net
        </a>
        .
      </p>
    </main>
  );
}
