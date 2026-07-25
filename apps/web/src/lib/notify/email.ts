import 'server-only';

// Domain must be verified in Resend before delivery works (DKIM/SPF DNS records).
const FROM = process.env.RESEND_FROM ?? 'Pikavolt LLC <no-reply@pikavolt.net>';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via Resend. No-ops (with a console.info) when RESEND_API_KEY
 * is absent so local dev and tests never require the service.
 */
export async function sendEmail(msg: EmailMessage) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:noop] → ${msg.to}: ${msg.subject}`);
    return { id: null, noop: true as const };
  }
  // Email is best-effort and MUST NOT throw: notify helpers run inside the
  // Stripe webhook handler, whose catch block removes the idempotency marker to
  // force a retry. A throw here (e.g. unverified sending domain) would make
  // Stripe retry the payment webhook forever. So we log and swallow instead.
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    });
    if (error) {
      console.error(`[email:failed] → ${msg.to}: ${msg.subject} — ${error.message}`);
      return { id: null, noop: false as const, error: error.message };
    }
    return { id: data?.id ?? null, noop: false as const };
  } catch (err) {
    console.error(`[email:failed] → ${msg.to}: ${msg.subject} —`, err);
    return { id: null, noop: false as const, error: String(err) };
  }
}

/** Shared branded shell for transactional emails. */
export function emailShell(title: string, bodyHtml: string, ctaText?: string, ctaUrl?: string) {
  const cta =
    ctaText && ctaUrl
      ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#FFE600;color:#081A21;font-weight:700;text-decoration:none;border-radius:8px">${ctaText}</a>`
      : '';
  return `<!doctype html><body style="margin:0;background:#081A21;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="color:#FFE600;font-size:22px;font-weight:800;letter-spacing:1px">⚡ PIKAVOLT LLC</div>
    <div style="background:#0E2A33;border-radius:12px;padding:28px;margin-top:16px;color:#F8FAFC">
      <h1 style="margin:0 0 12px;font-size:20px;color:#FFFFFF">${title}</h1>
      <div style="font-size:15px;line-height:1.6;color:#D8E4E9">${bodyHtml}</div>
      ${cta}
    </div>
    <p style="color:#9FB8C2;font-size:12px;margin-top:16px">Pikavolt LLC — Powering Ohio with Quality You Can Trust.<br/>24/7 Emergency: (614) 555-0199</p>
  </div></body>`;
}
