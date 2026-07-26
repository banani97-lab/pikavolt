/**
 * Twilio SMS sender.
 *
 * Mirrors email.ts: best-effort, NEVER throws (it runs alongside the Stripe
 * webhook and payment flows), and no-ops when unconfigured. Wired but inert
 * until Twilio credentials AND an A2P 10DLC-registered sender exist — US
 * business texting requires 10DLC brand/campaign approval before messages
 * deliver. Configure via:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and one sender:
 *   TWILIO_MESSAGING_SERVICE_SID (preferred — carries the 10DLC campaign) or
 *   TWILIO_FROM_NUMBER (E.164, e.g. +16144010766).
 *
 * Uses Twilio's REST API directly via fetch (no SDK dependency).
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

/** Whether Twilio is configured enough to attempt a send. */
export function isSmsConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && (MESSAGING_SERVICE_SID || FROM_NUMBER));
}

/**
 * Best-effort E.164 normalization. Returns null when the input can't be turned
 * into a plausible number (caller should then skip SMS for that recipient).
 * Assumes US (+1) for bare 10-digit numbers.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (hasPlus) return digits.length >= 8 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/**
 * Sends an SMS. Returns true on a successful Twilio hand-off, false when
 * skipped (unconfigured / bad number) or on any error. Never throws.
 */
export async function sendSms({ to, body }: { to: string; body: string }): Promise<boolean> {
  if (!isSmsConfigured()) {
    console.warn('[sms] TWILIO not configured — skipping SMS.');
    return false;
  }
  const normalized = normalizePhone(to);
  if (!normalized) {
    console.warn('[sms] invalid recipient number — skipping SMS.');
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.set('To', normalized);
    if (MESSAGING_SERVICE_SID) params.set('MessagingServiceSid', MESSAGING_SERVICE_SID);
    else params.set('From', FROM_NUMBER as string);
    params.set('Body', body);

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[sms] Twilio send failed', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[sms] send error', err);
    return false;
  }
}
