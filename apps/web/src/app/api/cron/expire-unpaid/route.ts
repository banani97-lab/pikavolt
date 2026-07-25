import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe, isStripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const EXPIRY_MINUTES = 30;

/**
 * GET /api/cron/expire-unpaid
 *
 * Cancels 'requested' appointments older than 30 minutes whose deposit never
 * succeeded — freeing the held slot — and cancels their pending
 * PaymentIntents so stale client secrets can't be paid later.
 *
 * Auth accepts either:
 *  - `Authorization: Bearer ${CRON_SECRET}` — how Vercel Cron invokes it (it
 *    injects this header automatically when CRON_SECRET is set); or
 *  - `x-cron-secret: ${SUPABASE_DB_WEBHOOK_SECRET}` — for manual/other triggers.
 */
export async function GET(request: Request) {
  const authorized =
    (!!process.env.CRON_SECRET &&
      request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) ||
    (!!process.env.SUPABASE_DB_WEBHOOK_SECRET &&
      request.headers.get('x-cron-secret') === process.env.SUPABASE_DB_WEBHOOK_SECRET);
  if (!authorized) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const admin = createAdminClient();
  // Expiry must work without Stripe — PI cancellation is best-effort extra.
  const stripe = isStripeConfigured() ? getStripe() : null;
  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data: stale, error } = await admin
    .from('appointments')
    .select('id, payments ( kind, status, stripe_payment_intent_id )')
    .eq('status', 'requested')
    .lt('created_at', cutoff);
  if (error) {
    console.error('[cron/expire-unpaid] query failed', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  let expired = 0;
  for (const appt of stale ?? []) {
    const payments = (appt.payments ?? []) as Array<{
      kind: string | null;
      status: string;
      stripe_payment_intent_id: string | null;
    }>;
    const deposits = payments.filter((p) => p.kind === 'deposit');
    if (deposits.some((p) => p.status === 'succeeded')) continue; // paid — owner will confirm

    // Cancel any still-pending deposit PaymentIntents (best effort).
    for (const p of deposits) {
      if (p.status === 'pending' && p.stripe_payment_intent_id) {
        if (stripe) {
          await stripe.paymentIntents.cancel(p.stripe_payment_intent_id).catch(() => {});
        }
        await admin
          .from('payments')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', p.stripe_payment_intent_id);
      }
    }

    const { error: cancelError } = await admin
      .from('appointments')
      .update({ status: 'cancelled', cancelled_reason: 'deposit_not_paid' })
      .eq('id', appt.id);
    if (cancelError) {
      console.error(`[cron/expire-unpaid] cancel failed for ${appt.id}`, cancelError);
      continue;
    }
    expired += 1;
  }

  return NextResponse.json({ checked: stale?.length ?? 0, expired });
}
