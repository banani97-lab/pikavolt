'use server';

import { randomBytes } from 'crypto';
import type Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureStripeCustomer, getStripe, isStripeConfigured } from '@/lib/stripe';
import { sendInvoiceRequest } from '@/lib/invoices';

export interface CreateInvoiceResult {
  ok: boolean;
  error?: string;
  appointmentId?: string;
  token?: string;
}

const CreateInvoiceSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    customerName: z.string().trim().min(1).max(120).optional(),
    customerEmail: z.string().trim().email().optional(),
    customerPhone: z.string().trim().max(20).optional(),
    description: z.string().trim().min(1, 'Add a short job description').max(500),
    totalCents: z.number().int().positive(),
    upfrontCents: z.number().int().min(0),
    channel: z.enum(['email', 'sms', 'both']),
    autoChargeRemainder: z.boolean().default(false),
  })
  .refine((v) => v.totalCents >= 15000, {
    message: 'Invoice total must be at least $150.',
    path: ['totalCents'],
  })
  .refine((v) => v.upfrontCents <= v.totalCents, {
    message: 'Upfront amount cannot exceed the total.',
    path: ['upfrontCents'],
  })
  .refine((v) => Boolean(v.customerId) || Boolean(v.customerEmail && v.customerName), {
    message: 'Select a customer, or enter a name and email for a new one.',
    path: ['customerEmail'],
  });

/** Only the owner may create invoices (admin client bypasses RLS). */
async function assertOwner(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in first.' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'owner') return { ok: false, error: 'Not authorized.' };
  return { ok: true };
}

export async function createInvoice(input: unknown): Promise<CreateInvoiceResult> {
  const auth = await assertOwner();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!isStripeConfigured()) {
    return { ok: false, error: 'Payments are not configured yet.' };
  }

  const parsed = CreateInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid invoice.' };
  }
  const v = parsed.data;

  const admin = createAdminClient();
  const stripe = getStripe();

  // 1. Resolve or create the customer. New customers get a lightweight
  //    background account (via handle_new_user trigger) — they pay through the
  //    tokenized link and never need to log in, but can later set a password.
  let customerId = v.customerId ?? null;
  if (!customerId) {
    const email = v.customerEmail!.toLowerCase();
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
      if (v.customerPhone) {
        await admin.from('profiles').update({ phone: v.customerPhone }).eq('id', existing.id);
      }
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: v.customerName },
      });
      if (createErr || !created?.user) {
        return { ok: false, error: `Could not create the customer: ${createErr?.message ?? 'unknown'}` };
      }
      customerId = created.user.id;
      await admin
        .from('profiles')
        .update({ full_name: v.customerName, phone: v.customerPhone ?? null })
        .eq('id', customerId);
    }
  }

  if (!customerId) {
    return { ok: false, error: 'Could not resolve the customer.' };
  }

  // 2. Ensure a Stripe customer valid in the current mode. Self-heals a stale
  //    test-mode or deleted id so an existing customer never 500s here.
  let stripeCustomerId: string;
  try {
    stripeCustomerId = await ensureStripeCustomer(admin, {
      userId: customerId,
      email: v.customerEmail,
      name: v.customerName,
    });
  } catch (err) {
    return {
      ok: false,
      error: `Stripe customer error: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }

  // 3. Create the invoice appointment. Off the booking calendar: scheduled_start
  //    == scheduled_end is an EMPTY range so the no-overlap constraint never
  //    applies. Status 'in_progress' so the existing "Job complete" → final
  //    path collects the balance; job_total is already known.
  const token = randomBytes(24).toString('base64url');
  const now = new Date().toISOString();
  const { data: appt, error: apptErr } = await admin
    .from('appointments')
    .insert({
      customer_id: customerId,
      address_id: null,
      status: 'in_progress',
      is_invoice: true,
      invoice_token: token,
      description: v.description,
      scheduled_start: now,
      scheduled_end: now,
      service_call_fee_cents: 0,
      job_total_cents: v.totalCents,
      auto_charge_consent: v.autoChargeRemainder,
      terms_accepted_at: now,
    })
    .select('id')
    .single();
  if (apptErr || !appt) {
    return { ok: false, error: `Could not create the invoice: ${apptErr?.message ?? 'unknown'}` };
  }

  // 4. Upfront charge (recorded as a 'deposit' so computeFinal later yields
  //    remainder = total − upfront). Interactive pay link; customer enters card
  //    or ACH on the public page. When upfront is 0, nothing is billed now — the
  //    full total is collected on completion.
  if (v.upfrontCents > 0) {
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create({
        amount: v.upfrontCents,
        currency: 'usd',
        customer: stripeCustomerId,
        automatic_payment_methods: { enabled: true },
        ...(v.autoChargeRemainder ? { setup_future_usage: 'off_session' as const } : {}),
        metadata: { appointment_id: appt.id, kind: 'deposit', invoice: 'true' },
      });
    } catch (err) {
      return {
        ok: false,
        error: `Could not create the upfront charge: ${err instanceof Error ? err.message : 'unknown error'}`,
      };
    }
    const { error: payErr } = await admin.from('payments').insert({
      appointment_id: appt.id,
      kind: 'deposit',
      amount_cents: v.upfrontCents,
      status: 'pending',
      stripe_payment_intent_id: intent.id,
    });
    if (payErr) {
      return { ok: false, error: `Could not record the upfront payment: ${payErr.message}` };
    }
    await sendInvoiceRequest(appt.id, {
      amountCents: v.upfrontCents,
      stage: 'upfront',
      channel: v.channel,
    });
  }

  revalidatePath('/admin/invoices');
  revalidatePath('/admin/appointments');
  revalidatePath('/admin');
  return { ok: true, appointmentId: appt.id, token };
}
