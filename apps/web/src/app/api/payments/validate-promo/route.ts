import { NextResponse } from 'next/server';
import { ValidatePromoRequestSchema, type ValidatePromoResponse } from '@pikavolt/core';
import { isStripeConfigured, PAYMENTS_NOT_CONFIGURED, validatePromoCode } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/validate-promo
 * Validates a Stripe Promotion Code and reports the discount it grants on
 * the $150 service call fee.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(PAYMENTS_NOT_CONFIGURED, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ValidatePromoRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  try {
    const result = await validatePromoCode(parsed.data.code);
    const body: ValidatePromoResponse = result.valid
      ? {
          valid: true,
          code: result.code,
          discountCents: result.discountCents,
          ...(result.percentOff != null ? { percentOff: result.percentOff } : {}),
        }
      : { valid: false, code: parsed.data.code };
    return NextResponse.json(body);
  } catch (err) {
    console.error('[api/payments/validate-promo]', err);
    return NextResponse.json({ error: 'Promo validation failed' }, { status: 500 });
  }
}
