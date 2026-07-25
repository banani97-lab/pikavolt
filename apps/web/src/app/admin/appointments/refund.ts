import 'server-only';

import { notifyCancellation } from '@/lib/appointments';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Owner-initiated cancellation: the deposit is ALWAYS refunded (unlike the
 * customer path in (app)/appointments/[id]/actions.ts, which enforces the
 * 24-hour eligibility window). Pending PaymentIntents are cancelled; succeeded
 * ones are refunded. Skips Stripe calls gracefully when not configured.
 */
export async function refundCancelledAppointment(
  appointmentId: string,
): Promise<{ refunded: boolean; note: string }> {
  const admin = createAdminClient();
  const stripe = isStripeConfigured() ? getStripe() : null;

  const { data: payments } = await admin
    .from('payments')
    .select('id, status, amount_cents, stripe_payment_intent_id')
    .eq('appointment_id', appointmentId);

  let refunded = false;
  let refundCents = 0;
  for (const p of payments ?? []) {
    if (!p.stripe_payment_intent_id) continue;
    if (p.status === 'pending' && stripe) {
      await stripe.paymentIntents.cancel(p.stripe_payment_intent_id).catch(() => {});
    } else if (p.status === 'succeeded') {
      if (!stripe) continue;
      await stripe.refunds.create({ payment_intent: p.stripe_payment_intent_id });
      await admin.from('payments').update({ status: 'refunded' }).eq('id', p.id);
      refunded = true;
      refundCents += p.amount_cents;
    }
  }

  await notifyCancellation(appointmentId, { refunded, refundCents }).catch((err) =>
    console.error('[refundCancelledAppointment] notify failed', err),
  );

  if (!stripe && (payments ?? []).some((p) => p.status === 'succeeded')) {
    return {
      refunded: false,
      note: 'Cancelled. Stripe is not configured yet — issue the deposit refund manually once keys are set.',
    };
  }
  return {
    refunded,
    note: refunded
      ? `Cancelled — deposit refund of $${(refundCents / 100).toFixed(2)} issued.`
      : 'Cancelled — no settled deposit to refund.',
  };
}
