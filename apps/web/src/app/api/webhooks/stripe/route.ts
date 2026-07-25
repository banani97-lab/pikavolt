import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  notifyBookingReceived,
  notifyFinalPayment,
  notifyOwnerNewBooking,
  notifyPaymentReceipt,
} from '@/lib/appointments';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 *
 * - Verifies the signature against STRIPE_WEBHOOK_SECRET.
 * - Idempotent via stripe_events (insert-or-skip on the event id).
 * - payment_intent.succeeded → payments row succeeded (+charge id, paid_at);
 *   deposit → booking-received email + owner push; final → completed→closed
 *   transition + receipt email.
 * - payment_intent.payment_failed → payments row failed; failed off-session
 *   final charges fall back to a pay-link email/push.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!secret || !signature) {
    return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (err) {
    console.error('[webhooks/stripe] signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: first writer wins; replays are acknowledged and skipped.
  const { error: dupError } = await admin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });
  if (dupError) {
    if (dupError.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('[webhooks/stripe] stripe_events insert failed', dupError);
    return NextResponse.json({ error: 'Event log failure' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(admin, pi);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(admin, pi);
        break;
      }
      default:
        break; // Unhandled event types are acknowledged.
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[webhooks/stripe] handler failed for ${event.type}`, err);
    // Remove the idempotency marker so Stripe's retry can reprocess.
    await admin.from('stripe_events').delete().eq('id', event.id);
    return NextResponse.json({ error: 'Handler failure' }, { status: 500 });
  }
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function handlePaymentSucceeded(admin: AdminClient, pi: Stripe.PaymentIntent) {
  const appointmentId = pi.metadata?.appointment_id;
  const kind = pi.metadata?.kind;
  if (!appointmentId || !kind) return;

  const chargeId =
    typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge?.id ?? null);

  await admin
    .from('payments')
    .update({
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      stripe_charge_id: chargeId,
    })
    .eq('stripe_payment_intent_id', pi.id);

  if (kind === 'deposit') {
    await notifyBookingReceived(appointmentId);
    await notifyOwnerNewBooking(appointmentId);
  } else if (kind === 'final') {
    // Final payment settled → completed → closed (DB trigger validates).
    const { data: appt } = await admin
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .maybeSingle();
    if (appt?.status === 'completed') {
      const { error } = await admin
        .from('appointments')
        .update({ status: 'closed' })
        .eq('id', appointmentId);
      if (error) console.error('[webhooks/stripe] completed→closed failed', error);
    }
    await notifyPaymentReceipt(appointmentId, 'final', pi.amount);
  }
}

async function handlePaymentFailed(admin: AdminClient, pi: Stripe.PaymentIntent) {
  const appointmentId = pi.metadata?.appointment_id;
  const kind = pi.metadata?.kind;
  if (!appointmentId || !kind) return;

  await admin
    .from('payments')
    .update({ status: 'failed' })
    .eq('stripe_payment_intent_id', pi.id);

  // Off-session auto-charge declined → pay-link fallback. (Interactive
  // failures are surfaced in the UI; no email spam for those.)
  if (kind === 'final' && pi.metadata?.off_session === 'true') {
    await notifyFinalPayment(appointmentId, pi.amount);
  }
}
