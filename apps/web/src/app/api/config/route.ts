import { NextResponse } from 'next/server';

// Always read env at request time and never cache — the whole point is that
// changing the server's Stripe env (+ redeploy) flips clients without a rebuild.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/config — public runtime configuration for clients.
 *
 * Returns the Stripe *publishable* key currently configured on the server. The
 * publishable key is not a secret (it already ships in the web client bundle),
 * so this endpoint needs no auth.
 *
 * Why this exists: the Flutter app's publishable key would otherwise be baked
 * into the binary at build time, meaning a Stripe test→live switch would need a
 * new App Store/Play build. By resolving the key from here at runtime, flipping
 * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (+ the secret key) on the server and
 * redeploying switches the mobile app on its next launch — no resubmission.
 *
 * The mobile app uses this as an override on top of its compile-time fallback
 * key, so an unreachable server still leaves payments working with the baked
 * key.
 */
export async function GET() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null;
  const isValid = typeof publishableKey === 'string' && publishableKey.startsWith('pk_');
  const mode = !isValid ? null : publishableKey.startsWith('pk_live') ? 'live' : 'test';

  return NextResponse.json(
    {
      stripePublishableKey: isValid ? publishableKey : null,
      stripeMode: mode,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
