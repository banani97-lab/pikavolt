import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, emailShell } from '@/lib/notify/email';
import { sendSms } from '@/lib/notify/sms';
import { sendPushToUser } from '@/lib/notify/push';
import { formatMoney, siteUrl, notifyFinalPayment } from '@/lib/appointments';

export type InvoiceChannel = 'email' | 'sms' | 'both';

/** Public, no-login pay link for an invoice. */
export function invoicePayUrl(token: string): string {
  return siteUrl(`/invoice/${token}`);
}

interface InvoiceContext {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  description: string | null;
  token: string | null;
}

async function getInvoiceContext(appointmentId: string): Promise<InvoiceContext | null> {
  const admin = createAdminClient();
  const { data: appt } = await admin
    .from('appointments')
    .select(
      `id, customer_id, description, invoice_token,
       profiles:customer_id ( email, full_name, phone )`,
    )
    .eq('id', appointmentId)
    .maybeSingle();
  if (!appt) return null;

  const profile = appt.profiles as unknown as {
    email: string | null;
    full_name: string | null;
    phone: string | null;
  } | null;

  return {
    id: appt.id,
    customerId: appt.customer_id,
    customerName: profile?.full_name || 'there',
    customerEmail: profile?.email ?? null,
    customerPhone: profile?.phone ?? null,
    description: appt.description,
    token: appt.invoice_token,
  };
}

/**
 * Sends an invoice pay request (upfront or remaining balance) over the chosen
 * channels. The link is the public tokenized pay page — no login required.
 * Best-effort per channel; never throws.
 */
export async function sendInvoiceRequest(
  appointmentId: string,
  opts: {
    amountCents: number;
    stage: 'upfront' | 'balance';
    channel: InvoiceChannel;
  },
): Promise<{ emailed: boolean; texted: boolean }> {
  const ctx = await getInvoiceContext(appointmentId);
  if (!ctx?.token) return { emailed: false, texted: false };

  const url = invoicePayUrl(ctx.token);
  const money = formatMoney(opts.amountCents);
  const stageLabel = opts.stage === 'upfront' ? 'deposit' : 'remaining balance';
  const jobLine = ctx.description ? ` for ${ctx.description}` : '';
  const wantEmail = opts.channel === 'email' || opts.channel === 'both';
  const wantSms = opts.channel === 'sms' || opts.channel === 'both';

  let emailed = false;
  let texted = false;

  if (wantEmail && ctx.customerEmail) {
    await sendEmail({
      to: ctx.customerEmail,
      subject: `Invoice from Pikavolt LLC — ${money} due`,
      html: emailShell(
        opts.stage === 'upfront' ? 'Your invoice is ready' : 'Balance due',
        `<p>Hi ${ctx.customerName},</p>
         <p>Pikavolt LLC has sent you an invoice${jobLine}. The ${stageLabel} of
         <strong>${money}</strong> is due.</p>
         <p style="margin-top:12px">Pay securely online — no account needed — with the button below.</p>`,
        `Pay ${money}`,
        url,
      ),
    });
    emailed = true;
  }

  if (wantSms && ctx.customerPhone) {
    texted = await sendSms({
      to: ctx.customerPhone,
      body: `Pikavolt LLC: your ${stageLabel} of ${money} is due${jobLine}. Pay securely here: ${url}`,
    });
  }

  // Push too, when the customer happens to have the app installed.
  await sendPushToUser(ctx.customerId, {
    type: 'invoice_due',
    title: opts.stage === 'upfront' ? 'New invoice' : 'Balance due',
    body: `${money} is due. Tap to pay securely.`,
    data: { appointmentId: ctx.id, url },
  });

  return { emailed, texted };
}

/**
 * Route a "balance due" notification to the right channel: invoices use the
 * public tokenized link (email + SMS, no login); normal appointments use the
 * standard logged-in pay page. Called by the final-payment route and the Stripe
 * webhook so neither needs to know about invoices.
 */
export async function notifyBalanceDue(
  appointmentId: string,
  amountCents: number,
): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('appointments')
    .select('is_invoice')
    .eq('id', appointmentId)
    .maybeSingle();

  if (data?.is_invoice) {
    await sendInvoiceRequest(appointmentId, {
      amountCents,
      stage: 'balance',
      channel: 'both',
    });
  } else {
    await notifyFinalPayment(appointmentId, amountCents);
  }
}

/** Receipt for an invoice payment (upfront or final) → email + push. */
export async function notifyInvoiceReceipt(
  appointmentId: string,
  amountCents: number,
  stage: 'upfront' | 'final',
): Promise<void> {
  const ctx = await getInvoiceContext(appointmentId);
  if (!ctx) return;

  const money = formatMoney(amountCents);
  const closing =
    stage === 'final'
      ? '<p style="margin-top:12px">Your invoice is paid in full. Thank you for your business!</p>'
      : '';

  if (ctx.customerEmail) {
    await sendEmail({
      to: ctx.customerEmail,
      subject: `Receipt — ${money} received`,
      html: emailShell(
        'Payment received — thank you!',
        `<p>Hi ${ctx.customerName},</p>
         <p>We received your payment of <strong>${money}</strong>${
           ctx.description ? ` for ${ctx.description}` : ''
         }.</p>
         ${closing}`,
      ),
    });
  }

  await sendPushToUser(ctx.customerId, {
    type: 'payment_receipt',
    title: 'Payment received',
    body: `${money} received. Thank you!`,
    data: { appointmentId: ctx.id },
  });
}
