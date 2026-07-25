import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { requireOwner } from '@/components/admin/ownerGuard';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Owner-only promo code management.
 *
 * Promo codes live in Stripe (coupon + promotion code) and are cached in the
 * `promotions` table. Rows are written with the service-role client because
 * RLS only grants owners SELECT on promotions.
 *
 * NOTE: STRIPE_SECRET_KEY is currently a placeholder in local dev — when it
 * is not configured these endpoints return 503 with a friendly message
 * instead of crashing. Live-Stripe verification is pending fresh sandbox keys.
 */

const STRIPE_NOT_CONFIGURED =
  'Stripe not configured yet — add a real STRIPE_SECRET_KEY to enable promo codes.';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith('sk_') || key.toUpperCase().includes('PLACEHOLDER')) {
    return null;
  }
  return new Stripe(key);
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promotions: data });
}

interface CreateBody {
  code?: string;
  percentOff?: number | null;
  amountOffCents?: number | null;
  /** ISO date (yyyy-mm-dd) after which the code stops working. */
  expiresAt?: string | null;
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const code = (body.code ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const percentOff = body.percentOff ?? null;
  const amountOffCents = body.amountOffCents ?? null;

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return NextResponse.json(
      { error: 'Code must be 3–32 characters (letters, numbers, - or _).' },
      { status: 400 },
    );
  }
  const hasPercent = percentOff !== null;
  const hasAmount = amountOffCents !== null;
  if (hasPercent === hasAmount) {
    return NextResponse.json(
      { error: 'Provide exactly one of percent off or amount off.' },
      { status: 400 },
    );
  }
  if (hasPercent && (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100)) {
    return NextResponse.json({ error: 'Percent off must be between 1 and 100.' }, { status: 400 });
  }
  if (hasAmount && (!Number.isInteger(amountOffCents) || amountOffCents <= 0)) {
    return NextResponse.json(
      { error: 'Amount off must be a positive whole number of cents.' },
      { status: 400 },
    );
  }

  let expiresAtUnix: number | undefined;
  if (body.expiresAt) {
    const t = Date.parse(`${body.expiresAt}T23:59:59`);
    if (Number.isNaN(t)) {
      return NextResponse.json({ error: 'Invalid expiry date.' }, { status: 400 });
    }
    if (t <= Date.now()) {
      return NextResponse.json({ error: 'Expiry date must be in the future.' }, { status: 400 });
    }
    expiresAtUnix = Math.floor(t / 1000);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('promotions')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: `Code "${code}" already exists.` }, { status: 409 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: STRIPE_NOT_CONFIGURED }, { status: 503 });
  }

  try {
    const coupon = await stripe.coupons.create(
      hasPercent
        ? { percent_off: percentOff, duration: 'once', name: code }
        : { amount_off: amountOffCents ?? 0, currency: 'usd', duration: 'once', name: code },
    );
    const promotionCode = await stripe.promotionCodes.create({
      promotion: { type: 'coupon', coupon: coupon.id },
      code,
      ...(expiresAtUnix ? { expires_at: expiresAtUnix } : {}),
    });

    const { data: row, error } = await admin
      .from('promotions')
      .insert({
        code,
        percent_off: hasPercent ? percentOff : null,
        amount_off_cents: hasAmount ? amountOffCents : null,
        stripe_coupon_id: coupon.id,
        stripe_promotion_code_id: promotionCode.id,
        active: true,
        created_by: owner.userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ promotion: row }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

interface PatchBody {
  id?: string;
  active?: boolean;
}

export async function PATCH(request: NextRequest) {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.id || body.active !== false) {
    return NextResponse.json(
      { error: 'Only deactivation is supported: pass { id, active: false }.' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('promotions')
    .select('id, stripe_promotion_code_id, active')
    .eq('id', body.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Promotion not found.' }, { status: 404 });

  let stripeNote: string | undefined;
  if (row.stripe_promotion_code_id) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.promotionCodes.update(row.stripe_promotion_code_id, { active: false });
      } catch (e) {
        stripeNote = `Row deactivated, but Stripe update failed: ${e instanceof Error ? e.message : 'unknown error'}`;
      }
    } else {
      stripeNote =
        'Row deactivated locally — Stripe not configured yet, deactivate the code in Stripe later.';
    }
  }

  const { error } = await admin.from('promotions').update({ active: false }).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, note: stripeNote });
}
