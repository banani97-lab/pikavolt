import { NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { computeDeposit, DepositRequestSchema, type DepositResponse } from '@pikavolt/core';
import { createApiClient } from '@/lib/supabase/api';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getStripe,
  isStripeConfigured,
  PAYMENTS_NOT_CONFIGURED,
  validatePromoCode,
} from '@/lib/stripe';
import {
  BUSINESS_TIMEZONE,
  computeSlotsForDate,
  getBookingSettings,
  notifyBookingReceived,
  notifyOwnerNewBooking,
} from '@/lib/appointments';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/deposit — DepositRequest → DepositResponse.
 *
 * 1. Auth: session user required.
 * 2. Re-validate the requested slot against live availability.
 * 3. Insert the appointment (status 'requested') with the service-role client;
 *    the DB exclusion constraint holds the slot — 23P01 conflict → 409.
 * 4. Get/create the Stripe customer (persisted on profiles.stripe_customer_id).
 * 5. Validate the promo code and compute the discount vs the service call fee.
 * 6. Create the deposit PaymentIntent (setup_future_usage 'off_session' iff
 *    the customer consented to auto-charge) and a pending payments row.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(PAYMENTS_NOT_CONFIGURED, { status: 503 });
  }

  const supabase = await createApiClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to book' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = DepositRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const req = parsed.data.appointment;

  if (!req.termsAccepted) {
    return NextResponse.json(
      { error: 'You must accept the terms and cancellation policy' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const stripe = getStripe();
  const settings = await getBookingSettings();

  // -- Address must belong to the caller ------------------------------------
  const { data: address } = await admin
    .from('addresses')
    .select('id, user_id')
    .eq('id', req.addressId)
    .maybeSingle();
  if (!address || address.user_id !== user.id) {
    return NextResponse.json({ error: 'Address not found' }, { status: 400 });
  }

  // -- Services must exist and be active ------------------------------------
  const serviceIds = [...new Set(req.serviceIds)];
  const { data: services } = await admin
    .from('services')
    .select('id')
    .in('id', serviceIds)
    .eq('is_active', true);
  if (!services || services.length !== serviceIds.length) {
    return NextResponse.json({ error: 'One or more services are invalid' }, { status: 400 });
  }

  // -- Slot re-validation ----------------------------------------------------
  const start = new Date(req.scheduledStart);
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Slot is in the past' }, { status: 400 });
  }
  const horizonMs = settings.bookingHorizonDays * 24 * 60 * 60 * 1000;
  if (start.getTime() > Date.now() + horizonMs) {
    return NextResponse.json(
      { error: `Bookings open up to ${settings.bookingHorizonDays} days out` },
      { status: 400 },
    );
  }

  const localDate = formatInTimeZone(start, BUSINESS_TIMEZONE, 'yyyy-MM-dd');
  const slots = await computeSlotsForDate(localDate, settings);
  const slot = slots.find((s) => new Date(s.startsAt).getTime() === start.getTime());
  if (!slot) {
    return NextResponse.json({ error: 'That time is not a bookable slot' }, { status: 400 });
  }
  if (!slot.available) {
    return NextResponse.json({ error: 'That slot was just taken' }, { status: 409 });
  }

  // -- Promo → discount --------------------------------------------------------
  const feeCents = settings.serviceCallFeeCents;
  let discountCents = 0;
  let promoCode: string | null = null;
  if (req.promoCode) {
    const promo = await validatePromoCode(req.promoCode, feeCents);
    if (!promo.valid) {
      return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
    }
    // A promo may cover the whole fee (e.g. a 100%-off reviewer/comp code).
    discountCents = Math.min(promo.discountCents, feeCents);
    promoCode = promo.code;
  }
  // Stripe can't process a PaymentIntent below $0.50, so any deposit that lands
  // under the minimum (including $0 from a 100%-off code) is waived entirely —
  // the booking is confirmed without a charge.
  const STRIPE_MIN_CENTS = 50;
  const rawDepositCents = computeDeposit(feeCents, discountCents);
  const depositWaived = rawDepositCents < STRIPE_MIN_CENTS;
  const depositCents = depositWaived ? 0 : rawDepositCents;

  // -- Hold the slot: insert the appointment ------------------------------------
  const { data: appointment, error: insertError } = await admin
    .from('appointments')
    .insert({
      customer_id: user.id,
      address_id: req.addressId,
      status: 'requested',
      is_emergency: false,
      scheduled_start: slot.startsAt,
      scheduled_end: slot.endsAt,
      description: req.description,
      service_call_fee_cents: feeCents,
      promo_code: promoCode,
      discount_cents: discountCents,
      auto_charge_consent: req.autoChargeConsent,
      terms_accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !appointment) {
    if (insertError?.code === '23P01') {
      return NextResponse.json({ error: 'That slot was just taken' }, { status: 409 });
    }
    console.error('[api/payments/deposit] insert failed', insertError);
    return NextResponse.json({ error: 'Could not create appointment' }, { status: 500 });
  }

  const releaseSlot = async () => {
    await admin
      .from('appointments')
      .update({ status: 'cancelled', cancelled_reason: 'payment_setup_failed' })
      .eq('id', appointment.id);
  };

  try {
    const { error: svcError } = await admin.from('appointment_services').insert(
      serviceIds.map((serviceId) => ({
        appointment_id: appointment.id,
        service_id: serviceId,
      })),
    );
    if (svcError) throw new Error(`appointment_services insert: ${svcError.message}`);

    // -- Waived deposit: no charge, confirm the booking directly ---------------
    // Mirrors the payment_intent.succeeded side effects the webhook would run.
    if (depositWaived) {
      const { error: payError } = await admin.from('payments').insert({
        appointment_id: appointment.id,
        kind: 'deposit',
        amount_cents: 0,
        status: 'succeeded',
        stripe_payment_intent_id: null,
        paid_at: new Date().toISOString(),
        promo_code: promoCode,
        discount_cents: discountCents,
      });
      if (payError) throw new Error(`payments insert (waived): ${payError.message}`);

      await notifyBookingReceived(appointment.id).catch(() => {});
      await notifyOwnerNewBooking(appointment.id).catch(() => {});

      const body: DepositResponse = {
        appointmentId: appointment.id,
        depositCents: 0,
        discountCents,
        depositWaived: true,
      };
      return NextResponse.json(body);
    }

    // -- Stripe customer -------------------------------------------------------
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, email, full_name')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email ?? undefined,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // -- Deposit PaymentIntent --------------------------------------------------
    const intent = await stripe.paymentIntents.create({
      amount: depositCents,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      ...(req.autoChargeConsent ? { setup_future_usage: 'off_session' as const } : {}),
      metadata: { appointment_id: appointment.id, kind: 'deposit' },
    });
    if (!intent.client_secret) throw new Error('PaymentIntent has no client_secret');

    const { error: payError } = await admin.from('payments').insert({
      appointment_id: appointment.id,
      kind: 'deposit',
      amount_cents: depositCents,
      status: 'pending',
      stripe_payment_intent_id: intent.id,
      promo_code: promoCode,
      discount_cents: discountCents,
    });
    if (payError) throw new Error(`payments insert: ${payError.message}`);

    const body: DepositResponse = {
      appointmentId: appointment.id,
      paymentIntentClientSecret: intent.client_secret,
      depositCents,
      discountCents,
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error('[api/payments/deposit]', err);
    await releaseSlot().catch(() => {});
    return NextResponse.json({ error: 'Could not set up the deposit payment' }, { status: 500 });
  }
}
