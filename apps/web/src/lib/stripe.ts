import 'server-only';

import Stripe from 'stripe';
import { SERVICE_CALL_FEE_CENTS } from '@pikavolt/core';

let stripeSingleton: Stripe | null = null;

/**
 * True when a real (non-placeholder) Stripe secret key is present.
 *
 * Endpoints that call the Stripe API must check this and return
 * 503 {"error":"payments_not_configured"} when false — the rest of the app
 * works fully without Stripe.
 */
export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && !/placeholder/i.test(key);
}

/** Shared 503 body for unconfigured-payments responses. */
export const PAYMENTS_NOT_CONFIGURED = { error: 'payments_not_configured' } as const;

/**
 * Server-side Stripe client (lazy singleton — never instantiated at module
 * top level). Constructing the client does not validate the key, so this is
 * also usable for local webhook *signature* verification with a placeholder
 * key; guard actual API calls with isStripeConfigured().
 */
export function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set — cannot create Stripe client.');
    }
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

export interface PromoValidation {
  valid: boolean;
  code: string;
  /** Discount applied against `feeCents`, capped at the fee. */
  discountCents: number;
  percentOff?: number;
  stripePromotionCodeId?: string;
}

/**
 * Validate a promo code against Stripe Promotion Codes and compute the
 * discount it grants on the service call fee.
 */
export async function validatePromoCode(
  code: string,
  feeCents: number = SERVICE_CALL_FEE_CENTS,
): Promise<PromoValidation> {
  const invalid: PromoValidation = { valid: false, code, discountCents: 0 };
  const trimmed = code.trim();
  if (!trimmed) return invalid;

  const stripe = getStripe();
  const { data } = await stripe.promotionCodes.list({
    code: trimmed,
    active: true,
    limit: 1,
    expand: ['data.promotion.coupon'],
  });
  const promo = data[0];
  if (!promo || !promo.active) return invalid;

  // API 2025+: the coupon hangs off promotion_code.promotion.
  let coupon = promo.promotion?.coupon ?? null;
  if (typeof coupon === 'string') {
    coupon = await stripe.coupons.retrieve(coupon);
  }
  if (!coupon || !coupon.valid) return invalid;

  if (coupon.amount_off != null) {
    if (coupon.currency && coupon.currency !== 'usd') return invalid;
    return {
      valid: true,
      code: promo.code,
      discountCents: Math.min(coupon.amount_off, feeCents),
      stripePromotionCodeId: promo.id,
    };
  }

  if (coupon.percent_off != null) {
    const discountCents = Math.min(
      Math.round((feeCents * coupon.percent_off) / 100),
      feeCents,
    );
    return {
      valid: true,
      code: promo.code,
      discountCents,
      percentOff: coupon.percent_off,
      stripePromotionCodeId: promo.id,
    };
  }

  return invalid;
}

/**
 * Best saved card for off-session charging: the customer's default payment
 * method if set, otherwise the most recently attached card.
 */
export async function getSavedPaymentMethodId(
  customerId: string,
): Promise<string | null> {
  const stripe = getStripe();

  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.deleted) {
    const def = customer.invoice_settings?.default_payment_method;
    if (typeof def === 'string') return def;
    if (def?.id) return def.id;
  }

  const { data } = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 1,
  });
  return data[0]?.id ?? null;
}
