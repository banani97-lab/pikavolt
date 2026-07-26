import { NextResponse } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { computeFinal, SERVICE_CALL_FEE_CENTS, type FinalPaymentResponse } from '@pikavolt/core';
import { createApiClient } from '@/lib/supabase/api';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getSavedPaymentMethodId,
  getStripe,
  isStripeConfigured,
  PAYMENTS_NOT_CONFIGURED,
} from '@/lib/stripe';
import { notifyBalanceDue } from '@/lib/invoices';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ appointmentId: z.string().min(1) });

/**
 * POST /api/payments/final  { appointmentId } → FinalPaymentResponse
 *
 * Authorization: signed-in owner, or internal callers presenting
 * `x-internal-secret: $SUPABASE_DB_WEBHOOK_SECRET`.
 *
 * Flow (order is deliberate):
 * 1. Validate: status must be 'in_progress' and job_total_cents set ≥ fee.
 * 2. Compute final = jobTotal − discount − depositPaid (core computeFinal).
 * 3. Transition in_progress → completed FIRST — the work is done regardless
 *    of how the money lands; 'closed' only happens after the final payment
 *    succeeds (via the Stripe webhook, or immediately for a $0 balance).
 * 4. Charge: consent + saved card → off-session confirm now (decline falls
 *    back to a pay link); otherwise create the PI and send the pay link.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(PAYMENTS_NOT_CONFIGURED, { status: 503 });
  }

  const authorized = await isAuthorized(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 });
  }
  const { appointmentId } = parsed.data;

  const admin = createAdminClient();
  const stripe = getStripe();

  const { data: appt } = await admin
    .from('appointments')
    .select(
      'id, status, customer_id, job_total_cents, discount_cents, auto_charge_consent, service_call_fee_cents',
    )
    .eq('id', appointmentId)
    .maybeSingle();
  if (!appt) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }
  // Accept both entry paths: this endpoint can be called directly while the
  // appointment is still in_progress (it does the transition), OR after the
  // completeJob action (web admin / mobile owner) has already moved it to
  // completed. Anything else is a real conflict.
  if (appt.status !== 'in_progress' && appt.status !== 'completed') {
    return NextResponse.json(
      { error: `Appointment must be in_progress or completed (is '${appt.status}')` },
      { status: 409 },
    );
  }
  if (appt.job_total_cents == null || appt.job_total_cents < SERVICE_CALL_FEE_CENTS) {
    return NextResponse.json(
      { error: 'job_total_cents must be set and at least the service call fee' },
      { status: 400 },
    );
  }

  // Idempotency: if a final charge is already in flight or settled, don't start
  // another (e.g. a retry after completeJob transitioned the status and the
  // first call 409'd, or a double-click). A 'failed' row is ignored so declines
  // can be retried.
  const { data: existingFinal } = await admin
    .from('payments')
    .select('status')
    .eq('appointment_id', appointmentId)
    .eq('kind', 'final')
    .neq('status', 'failed')
    .maybeSingle();
  if (existingFinal) {
    const already: FinalPaymentResponse =
      existingFinal.status === 'succeeded'
        ? { status: 'charged' }
        : { status: 'payment_link_sent' };
    return NextResponse.json(already);
  }

  // Deposit actually collected for this appointment.
  const { data: depositRow } = await admin
    .from('payments')
    .select('amount_cents')
    .eq('appointment_id', appointmentId)
    .eq('kind', 'deposit')
    .eq('status', 'succeeded')
    .maybeSingle();
  const depositPaidCents = depositRow?.amount_cents ?? 0;

  const finalCents = computeFinal(
    appt.job_total_cents,
    appt.discount_cents,
    depositPaidCents,
  );

  // Work is done → completed (before any charge attempt). Skip when completeJob
  // already transitioned it — 'completed' → 'completed' would be rejected by the
  // state-machine trigger.
  if (appt.status === 'in_progress') {
    const { error: completeError } = await admin
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', appointmentId);
    if (completeError) {
      console.error('[api/payments/final] in_progress→completed failed', completeError);
      return NextResponse.json({ error: 'Could not complete appointment' }, { status: 500 });
    }
  }

  // Nothing owed (fully covered by discount + deposit) → close immediately.
  if (finalCents === 0) {
    await admin.from('payments').insert({
      appointment_id: appointmentId,
      kind: 'final',
      amount_cents: 0,
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      discount_cents: appt.discount_cents,
    });
    await admin.from('appointments').update({ status: 'closed' }).eq('id', appointmentId);
    const body: FinalPaymentResponse = { status: 'charged' };
    return NextResponse.json(body);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', appt.customer_id)
    .single();
  const customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
    return NextResponse.json(
      { error: 'Customer has no Stripe customer record' },
      { status: 500 },
    );
  }

  const insertPaymentRow = async (pi: Stripe.PaymentIntent) => {
    const { error } = await admin.from('payments').insert({
      appointment_id: appointmentId,
      kind: 'final',
      amount_cents: finalCents,
      status: 'pending',
      stripe_payment_intent_id: pi.id,
      discount_cents: appt.discount_cents,
    });
    if (error) throw new Error(`payments insert: ${error.message}`);
  };

  const sendPayLink = async (notify = true): Promise<FinalPaymentResponse> => {
    const pi = await stripe.paymentIntents.create({
      amount: finalCents,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { appointment_id: appointmentId, kind: 'final' },
    });
    await insertPaymentRow(pi);
    if (notify) await notifyBalanceDue(appointmentId, finalCents);
    return {
      status: 'payment_link_sent',
      paymentIntentClientSecret: pi.client_secret ?? undefined,
    };
  };

  try {
    if (appt.auto_charge_consent) {
      const paymentMethodId = await getSavedPaymentMethodId(customerId);
      if (paymentMethodId) {
        // Create first, record the row, then confirm — so the webhook always
        // finds the payments row whichever way the confirm lands.
        const pi = await stripe.paymentIntents.create({
          amount: finalCents,
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          metadata: { appointment_id: appointmentId, kind: 'final', off_session: 'true' },
        });
        await insertPaymentRow(pi);

        try {
          const confirmed = await stripe.paymentIntents.confirm(pi.id, {
            off_session: true,
          });
          if (confirmed.status === 'succeeded') {
            const body: FinalPaymentResponse = { status: 'charged' };
            return NextResponse.json(body);
          }
          if (confirmed.status === 'requires_action') {
            await notifyBalanceDue(appointmentId, finalCents);
            const body: FinalPaymentResponse = {
              status: 'requires_action',
              paymentIntentClientSecret: confirmed.client_secret ?? undefined,
            };
            return NextResponse.json(body);
          }
          // Any other non-terminal status → treat as needing the customer.
          await notifyBalanceDue(appointmentId, finalCents);
          const body: FinalPaymentResponse = {
            status: 'payment_link_sent',
            paymentIntentClientSecret: confirmed.client_secret ?? undefined,
          };
          return NextResponse.json(body);
        } catch (err) {
          // Card declined off-session → mark failed, cancel the attempt, and
          // fall back to a fresh interactive PI + pay link. (The webhook's
          // payment_failed handler sends the pay-link notification.)
          console.warn('[api/payments/final] off-session confirm failed', err);
          await admin
            .from('payments')
            .update({ status: 'failed' })
            .eq('stripe_payment_intent_id', pi.id);
          await stripe.paymentIntents.cancel(pi.id).catch(() => {});
          // The payment_failed webhook sends the pay-link notification for
          // off-session declines — don't email twice.
          const body = await sendPayLink(false);
          return NextResponse.json(body);
        }
      }
    }

    const body = await sendPayLink();
    return NextResponse.json(body);
  } catch (err) {
    console.error('[api/payments/final]', err);
    return NextResponse.json({ error: 'Final payment setup failed' }, { status: 500 });
  }
}

/** Owner session, or internal secret header (cron / DB hooks / mobile owner API). */
async function isAuthorized(request: Request): Promise<boolean> {
  const internal = request.headers.get('x-internal-secret');
  if (internal && internal === process.env.SUPABASE_DB_WEBHOOK_SECRET) return true;

  const supabase = await createApiClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  return profile?.role === 'owner';
}
