'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { getBookingSettings, notifyCancellation } from '@/lib/appointments';

export type CancelResult =
  | { ok: true; refunded: boolean; refundCents: number }
  | { ok: false; error: string };

/**
 * Customer cancels their own appointment.
 *
 * - The status flip runs through the USER client, so RLS + the DB transition
 *   trigger enforce that only the customer's own requested/confirmed
 *   appointment can move to cancelled.
 * - Refund policy is enforced SERVER-side here: full deposit refund when the
 *   cancellation is ≥ cancellation_window_hours (24h) before the slot;
 *   otherwise the deposit is kept. Refunds run with the service role +
 *   Stripe, never from the client.
 */
export async function cancelAppointment(appointmentId: string): Promise<CancelResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in first' };

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, status, scheduled_start, customer_id')
    .eq('id', appointmentId)
    .maybeSingle();
  if (!appt || appt.customer_id !== user.id) {
    return { ok: false, error: 'Appointment not found' };
  }
  if (appt.status !== 'requested' && appt.status !== 'confirmed') {
    return { ok: false, error: 'This appointment can no longer be cancelled online' };
  }

  const settings = await getBookingSettings();
  const windowMs = settings.cancellationWindowHours * 60 * 60 * 1000;
  const refundEligible =
    new Date(appt.scheduled_start).getTime() - Date.now() >= windowMs;

  // Status flip under the user's own RLS policy + transition trigger.
  const { error: cancelError } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', cancelled_reason: 'customer_cancelled' })
    .eq('id', appointmentId);
  if (cancelError) {
    console.error('[cancelAppointment] status update failed', cancelError);
    return { ok: false, error: 'Could not cancel the appointment' };
  }

  // Money handling with the service role. When Stripe isn't configured the
  // cancel itself still works — refunds/PI cancels are simply skipped.
  const admin = createAdminClient();
  const stripe = isStripeConfigured() ? getStripe() : null;
  const { data: payments } = await admin
    .from('payments')
    .select('id, status, amount_cents, stripe_payment_intent_id')
    .eq('appointment_id', appointmentId)
    .eq('kind', 'deposit');

  let refunded = false;
  let refundCents = 0;

  for (const p of payments ?? []) {
    if (p.status === 'pending' && p.stripe_payment_intent_id) {
      // Deposit never settled — just cancel the intent.
      if (stripe) {
        await stripe.paymentIntents.cancel(p.stripe_payment_intent_id).catch(() => {});
      }
      await admin.from('payments').update({ status: 'failed' }).eq('id', p.id);
    } else if (
      p.status === 'succeeded' &&
      p.stripe_payment_intent_id &&
      refundEligible &&
      stripe
    ) {
      try {
        await stripe.refunds.create({ payment_intent: p.stripe_payment_intent_id });
        await admin.from('payments').update({ status: 'refunded' }).eq('id', p.id);
        refunded = true;
        refundCents += p.amount_cents;
      } catch (err) {
        console.error('[cancelAppointment] refund failed', err);
      }
    }
  }

  await notifyCancellation(appointmentId, { refunded, refundCents }).catch(() => {});

  revalidatePath('/appointments');
  revalidatePath(`/appointments/${appointmentId}`);
  return { ok: true, refunded, refundCents };
}
