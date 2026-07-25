import 'server-only';

import { formatInTimeZone } from 'date-fns-tz';
import {
  computeSlots,
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_SLOT_DURATION_MINUTES,
  DEFAULT_TIMEZONE,
  SERVICE_CALL_FEE_CENTS,
  DEPOSIT_PERCENT,
  type BusinessHours,
  type Slot,
} from '@pikavolt/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, emailShell } from '@/lib/notify/email';
import { sendPushToUser, sendPushToOwner } from '@/lib/notify/push';

export const BUSINESS_TIMEZONE = DEFAULT_TIMEZONE;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** e.g. "Tuesday, July 14, 2026 at 8:00 AM EDT" (business timezone). */
export function formatSlotStart(iso: string): string {
  return formatInTimeZone(
    new Date(iso),
    BUSINESS_TIMEZONE,
    "EEEE, MMMM d, yyyy 'at' h:mm a zzz",
  );
}

export function siteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

// ---------------------------------------------------------------------------
// Booking settings (app_settings)
// ---------------------------------------------------------------------------

export interface BookingSettings {
  slotDurationMinutes: number;
  bufferMinutes: number;
  serviceCallFeeCents: number;
  depositPercent: number;
  cancellationWindowHours: number;
  bookingHorizonDays: number;
}

const SETTINGS_DEFAULTS: BookingSettings = {
  slotDurationMinutes: DEFAULT_SLOT_DURATION_MINUTES,
  bufferMinutes: DEFAULT_BUFFER_MINUTES,
  serviceCallFeeCents: SERVICE_CALL_FEE_CENTS,
  depositPercent: DEPOSIT_PERCENT,
  cancellationWindowHours: 24,
  bookingHorizonDays: 30,
};

export async function getBookingSettings(): Promise<BookingSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from('app_settings').select('key, value');
  const map = new Map<string, unknown>((data ?? []).map((r) => [r.key, r.value]));

  const num = (key: string, fallback: number): number => {
    const v = map.get(key);
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  };

  return {
    slotDurationMinutes: num('slot_duration_minutes', SETTINGS_DEFAULTS.slotDurationMinutes),
    bufferMinutes: num('buffer_minutes', SETTINGS_DEFAULTS.bufferMinutes),
    serviceCallFeeCents: num('service_call_fee_cents', SETTINGS_DEFAULTS.serviceCallFeeCents),
    depositPercent: num('deposit_percent', SETTINGS_DEFAULTS.depositPercent),
    cancellationWindowHours: num(
      'cancellation_window_hours',
      SETTINGS_DEFAULTS.cancellationWindowHours,
    ),
    bookingHorizonDays: num('booking_horizon_days', SETTINGS_DEFAULTS.bookingHorizonDays),
  };
}

// ---------------------------------------------------------------------------
// Slot computation against the database
// ---------------------------------------------------------------------------

/**
 * Compute the bookable slots for a calendar date ('YYYY-MM-DD', business
 * timezone) from business_hours, blocked_slots, and non-cancelled
 * appointments. Used by GET /api/slots and re-validation in the deposit route.
 */
export async function computeSlotsForDate(
  date: string,
  settings?: BookingSettings,
): Promise<Slot[]> {
  const admin = createAdminClient();
  const s = settings ?? (await getBookingSettings());

  // Window generously covering the local day plus buffers on both sides.
  const windowStart = new Date(`${date}T00:00:00Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - 1);
  const windowEnd = new Date(`${date}T00:00:00Z`);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);

  const [{ data: hours }, { data: blocked }, { data: appts }] = await Promise.all([
    admin.from('business_hours').select('day_of_week, opens_at, closes_at, is_open'),
    admin
      .from('blocked_slots')
      .select('starts_at, ends_at')
      .lt('starts_at', windowEnd.toISOString())
      .gt('ends_at', windowStart.toISOString()),
    admin
      .from('appointments')
      .select('scheduled_start, scheduled_end')
      .not('status', 'in', '(cancelled,no_show)')
      .lt('scheduled_start', windowEnd.toISOString())
      .gt('scheduled_end', windowStart.toISOString()),
  ]);

  const businessHours: BusinessHours[] = (hours ?? []).map((h) => ({
    dayOfWeek: h.day_of_week,
    // time columns come back as 'HH:MM:SS' — computeSlots wants 'HH:MM'.
    opensAt: (h.opens_at ?? '00:00').slice(0, 5),
    closesAt: (h.closes_at ?? '00:00').slice(0, 5),
    isOpen: h.is_open && h.opens_at != null && h.closes_at != null,
  }));

  return computeSlots({
    date,
    businessHours,
    blockedRanges: (blocked ?? []).map((b) => ({ startsAt: b.starts_at, endsAt: b.ends_at })),
    appointmentRanges: (appts ?? []).map((a) => ({
      startsAt: a.scheduled_start,
      endsAt: a.scheduled_end,
    })),
    slotDurationMinutes: s.slotDurationMinutes,
    bufferMinutes: s.bufferMinutes,
    timezone: BUSINESS_TIMEZONE,
  });
}

// ---------------------------------------------------------------------------
// Appointment context (shared by all notifications)
// ---------------------------------------------------------------------------

interface AppointmentContext {
  id: string;
  status: string;
  scheduledStart: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string;
  addressLine: string;
  serviceNames: string[];
  serviceCallFeeCents: number;
  discountCents: number;
  jobTotalCents: number | null;
}

async function getAppointmentContext(appointmentId: string): Promise<AppointmentContext | null> {
  const admin = createAdminClient();
  const { data: appt } = await admin
    .from('appointments')
    .select(
      `id, status, scheduled_start, customer_id, service_call_fee_cents, discount_cents, job_total_cents,
       profiles:customer_id ( email, full_name ),
       addresses:address_id ( line1, line2, city, state, zip ),
       appointment_services ( services ( name ) )`,
    )
    .eq('id', appointmentId)
    .maybeSingle();

  if (!appt) return null;

  const profile = appt.profiles as unknown as { email: string | null; full_name: string | null } | null;
  const addr = appt.addresses as unknown as {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    zip: string;
  } | null;
  const services = (appt.appointment_services as unknown as Array<{
    services: { name: string } | null;
  }>) ?? [];

  return {
    id: appt.id,
    status: appt.status,
    scheduledStart: appt.scheduled_start,
    customerId: appt.customer_id,
    customerEmail: profile?.email ?? null,
    customerName: profile?.full_name || 'there',
    addressLine: addr
      ? [addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.zip}`].filter(Boolean).join(', ')
      : '',
    serviceNames: services.map((s) => s.services?.name).filter((n): n is string => !!n),
    serviceCallFeeCents: appt.service_call_fee_cents,
    discountCents: appt.discount_cents,
    jobTotalCents: appt.job_total_cents,
  };
}

function servicesHtml(ctx: AppointmentContext): string {
  if (!ctx.serviceNames.length) return '';
  return `<p style="margin:12px 0 0"><strong>Services:</strong> ${ctx.serviceNames.join(', ')}</p>`;
}

// ---------------------------------------------------------------------------
// Notifications — exported helpers (the admin workstream calls
// notifyBookingConfirmed / notifyFinalPayment directly)
// ---------------------------------------------------------------------------

/**
 * Deposit paid → "booking received" email to the customer.
 * (The owner push for a new booking is sent separately by the Stripe webhook.)
 */
export async function notifyBookingReceived(appointmentId: string): Promise<void> {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx?.customerEmail) return;

  const depositLine = formatMoney(
    Math.max(Math.ceil((ctx.serviceCallFeeCents - ctx.discountCents) / 2), 0),
  );
  await sendEmail({
    to: ctx.customerEmail,
    subject: 'Booking received — deposit paid',
    html: emailShell(
      'We got your booking request!',
      `<p>Hi ${ctx.customerName},</p>
       <p>Your deposit of <strong>${depositLine}</strong> is paid and your service call is
       <strong>requested</strong> for <strong>${formatSlotStart(ctx.scheduledStart)}</strong>
       at ${ctx.addressLine}.</p>
       ${servicesHtml(ctx)}
       <p style="margin-top:12px">We'll confirm your appointment shortly. Cancel at least 24 hours
       before your slot for a full deposit refund.</p>`,
      'View appointment',
      siteUrl(`/appointments/${ctx.id}`),
    ),
  });
}

/**
 * Owner confirmed the appointment → email + push to the customer.
 * Exported for the admin workstream to call after a requested→confirmed transition.
 */
export async function notifyBookingConfirmed(appointmentId: string): Promise<void> {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) return;

  if (ctx.customerEmail) {
    await sendEmail({
      to: ctx.customerEmail,
      subject: 'Your appointment is confirmed ⚡',
      html: emailShell(
        'Appointment confirmed',
        `<p>Hi ${ctx.customerName},</p>
         <p>Your service call is confirmed for
         <strong>${formatSlotStart(ctx.scheduledStart)}</strong> at ${ctx.addressLine}.</p>
         ${servicesHtml(ctx)}
         <p style="margin-top:12px">You'll get a heads-up when your electrician is on the way.</p>`,
        'View appointment',
        siteUrl(`/appointments/${ctx.id}`),
      ),
    });
  }

  await sendPushToUser(ctx.customerId, {
    type: 'booking_confirmed',
    title: 'Appointment confirmed',
    body: `Your service call on ${formatSlotStart(ctx.scheduledStart)} is confirmed.`,
    data: { appointmentId: ctx.id },
  });
}

/**
 * The technician just tapped "On My Way" (→ en_route). Notify the customer
 * with a live-tracking link. Fires from BOTH the web admin action and the
 * mobile owner app (via /api/hooks/appointment-en-route), so it is written to
 * be idempotent-safe to call more than once (email/push are cheap + harmless).
 */
export async function notifyTechEnRoute(appointmentId: string): Promise<void> {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) return;

  if (ctx.customerEmail) {
    await sendEmail({
      to: ctx.customerEmail,
      subject: 'Your electrician is on the way ⚡',
      html: emailShell(
        'On the way',
        `<p>Hi ${ctx.customerName},</p>
         <p>Fares is on the way to <strong>${ctx.addressLine}</strong>. You can watch
         his live location and ETA on your appointment page.</p>`,
        'Track live',
        siteUrl(`/appointments/${ctx.id}`),
      ),
    });
  }

  await sendPushToUser(ctx.customerId, {
    type: 'tech_en_route',
    title: 'Your electrician is on the way ⚡',
    body: 'Tap to watch Fares approach in real time.',
    data: { appointmentId: ctx.id },
  });
}

/**
 * A final payment needs customer action → email + push with a pay link.
 * Exported for the admin workstream / final-payment route / webhook fallback.
 */
export async function notifyFinalPayment(
  appointmentId: string,
  amountCents: number,
): Promise<void> {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) return;
  const payUrl = siteUrl(`/appointments/${ctx.id}/pay`);

  if (ctx.customerEmail) {
    await sendEmail({
      to: ctx.customerEmail,
      subject: `Final payment due — ${formatMoney(amountCents)}`,
      html: emailShell(
        'Your final payment is ready',
        `<p>Hi ${ctx.customerName},</p>
         <p>Your service call at ${ctx.addressLine} is complete. The remaining balance is
         <strong>${formatMoney(amountCents)}</strong>.</p>
         <p style="margin-top:12px">Pay securely online with the button below.</p>`,
        `Pay ${formatMoney(amountCents)}`,
        payUrl,
      ),
    });
  }

  await sendPushToUser(ctx.customerId, {
    type: 'final_payment_due',
    title: 'Final payment due',
    body: `${formatMoney(amountCents)} is due for your completed service call.`,
    data: { appointmentId: ctx.id, url: payUrl },
  });
}

/** Payment receipt (deposit or final) → email to the customer. */
export async function notifyPaymentReceipt(
  appointmentId: string,
  kind: 'deposit' | 'final' | 'extra',
  amountCents: number,
): Promise<void> {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx?.customerEmail) return;

  const label = kind === 'deposit' ? 'deposit' : 'final payment';
  await sendEmail({
    to: ctx.customerEmail,
    subject: `Receipt — ${formatMoney(amountCents)} ${label}`,
    html: emailShell(
      'Payment received — thank you!',
      `<p>Hi ${ctx.customerName},</p>
       <p>We received your ${label} of <strong>${formatMoney(amountCents)}</strong> for the
       service call at ${ctx.addressLine}.</p>
       ${
         kind === 'final'
           ? '<p style="margin-top:12px">Your appointment is all wrapped up. Thanks for choosing Pikavolt!</p>'
           : ''
       }`,
      'View appointment',
      siteUrl(`/appointments/${ctx.id}`),
    ),
  });

  await sendPushToUser(ctx.customerId, {
    type: 'payment_receipt',
    title: 'Payment received',
    body: `${formatMoney(amountCents)} ${label} received. Thank you!`,
    data: { appointmentId: ctx.id },
  });
}

/** Cancellation email with refund status. */
export async function notifyCancellation(
  appointmentId: string,
  opts: { refunded: boolean; refundCents?: number },
): Promise<void> {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx?.customerEmail) return;

  const refundLine = opts.refunded
    ? `<p>Your deposit${
        opts.refundCents != null ? ` of <strong>${formatMoney(opts.refundCents)}</strong>` : ''
      } has been refunded to your original payment method. It may take 5–10 business days to appear.</p>`
    : `<p>Because the appointment was cancelled less than 24 hours before the scheduled slot, the deposit is non-refundable per our cancellation policy.</p>`;

  await sendEmail({
    to: ctx.customerEmail,
    subject: 'Appointment cancelled',
    html: emailShell(
      'Appointment cancelled',
      `<p>Hi ${ctx.customerName},</p>
       <p>Your service call scheduled for <strong>${formatSlotStart(ctx.scheduledStart)}</strong>
       has been cancelled.</p>
       ${refundLine}
       <p style="margin-top:12px">Need to rebook? We're ready when you are.</p>`,
      'Book again',
      siteUrl('/book'),
    ),
  });
}

/** Push to the owner when a new paid booking lands. */
export async function notifyOwnerNewBooking(appointmentId: string): Promise<void> {
  const ctx = await getAppointmentContext(appointmentId);
  await sendPushToOwner({
    type: 'new_booking',
    title: 'New booking ⚡',
    body: ctx
      ? `${ctx.customerName} booked ${formatSlotStart(ctx.scheduledStart)} — deposit paid.`
      : 'A new booking just came in.',
    data: { appointmentId },
  });
}
