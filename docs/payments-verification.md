# Payments E2E Verification (run when real Stripe sandbox keys land)

The booking + payments engine is built and verified against the local stack
**except** live-Stripe paths, because `STRIPE_SECRET_KEY` is currently the
placeholder `sk_test_PLACEHOLDER_pikavolt_sandbox`. Every endpoint that would
call the Stripe API returns `503 {"error":"payments_not_configured"}` until a
real key is present (see `apps/web/src/lib/stripe.ts` → `isStripeConfigured()`).

Everything below is copy-paste runnable the moment keys arrive.

## 0. Prerequisites

- Local Supabase running + seeded (`http://127.0.0.1:54321`).
- Web dev server running on port 3000 (`pnpm --filter web dev`).
- Stripe CLI authenticated against the **Pikavolt** sandbox (`stripe login`).

## 1. Configure keys

Edit `apps/web/.env.local`:

```
STRIPE_SECRET_KEY=sk_test_...            # real sandbox secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...   # for the browser Payment Element
```

Start webhook forwarding (keep running in its own terminal) and set the secret:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe &
stripe listen --print-secret   # → whsec_...
# put that value in apps/web/.env.local:
# STRIPE_WEBHOOK_SECRET=whsec_...
```

Restart the dev server so it picks up the new env values.

## 2. Scripted money path

Save as `/tmp/pikavolt-money-e2e.mjs` and run `node /tmp/pikavolt-money-e2e.mjs`
from the repo root. It exercises: signup → address → slots → **deposit**
(server-side PI confirm with `pm_card_visa`) → webhook settle → status
lifecycle → **final off-session auto-charge** → appointment `closed` →
double-book 409 → promo validation.

```js
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/apps/web/package.json');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = process.env.ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY = process.env.SERVICE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const BASE = 'http://localhost:3000';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY; // export before running
if (!STRIPE_KEY || /placeholder/i.test(STRIPE_KEY)) throw new Error('export STRIPE_SECRET_KEY=sk_test_... first');

const stripe = new Stripe(STRIPE_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const rand = Math.random().toString(36).slice(2, 8);
const ok = (name, cond, extra='') => { console.log(`${cond ? '  ok  ' : '  FAIL'} ${name} ${cond ? '' : extra}`); if (!cond) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -- user + session cookie ---------------------------------------------------
const email = `money-${rand}@example.com`, password = 'Str0ng-passw0rd!';
await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Money Path' } });
const userClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const { data: { session, user } } = await userClient.auth.signInWithPassword({ email, password });
const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;

// -- address ------------------------------------------------------------------
const { data: addr } = await userClient.from('addresses').insert({
  user_id: user.id, line1: '123 Volt St', city: 'Dublin', state: 'OH', zip: '43016',
  property_type: 'residential', is_default: true,
}).select('id').single();

// -- slots ----------------------------------------------------------------------
let date, slot;
for (let d = 7; d < 15 && !slot; d++) {
  date = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const { slots } = await (await fetch(`${BASE}/api/slots?date=${date}`)).json();
  slot = slots?.find((s) => s.available);
}
ok('seeded hours produce an available slot', !!slot);

// -- deposit ---------------------------------------------------------------------
const { data: svc } = await admin.from('services').select('id').limit(2);
const depRes = await fetch(`${BASE}/api/payments/deposit`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ appointment: {
    addressId: addr.id, scheduledStart: slot.startsAt, serviceIds: svc.map((s) => s.id),
    description: 'money-path e2e', autoChargeConsent: true, termsAccepted: true,
  }}),
});
const dep = await depRes.json();
ok('deposit endpoint 200', depRes.status === 200, JSON.stringify(dep));
ok('deposit is $75.00', dep.depositCents === 7500);
const piId = dep.paymentIntentClientSecret.split('_secret')[0];

// -- double-book the SAME slot → 409 ----------------------------------------------
const dup = await fetch(`${BASE}/api/payments/deposit`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ appointment: {
    addressId: addr.id, scheduledStart: slot.startsAt, serviceIds: [svc[0].id],
    description: 'dup', autoChargeConsent: false, termsAccepted: true,
  }}),
});
ok('double-book same slot → 409', dup.status === 409, String(dup.status));

// -- confirm deposit PI server-side (in lieu of the browser Payment Element) ------
const confirmed = await stripe.paymentIntents.confirm(piId, {
  payment_method: 'pm_card_visa', return_url: `${BASE}/appointments`,
});
ok('deposit PI succeeded', confirmed.status === 'succeeded', confirmed.status);

// -- wait for the forwarded webhook to settle the payment --------------------------
let payRow;
for (let i = 0; i < 20; i++) {
  await sleep(1000);
  ({ data: payRow } = await admin.from('payments').select('status, stripe_charge_id')
    .eq('stripe_payment_intent_id', piId).single());
  if (payRow?.status === 'succeeded') break;
}
ok('webhook marked deposit succeeded (+charge id)', payRow?.status === 'succeeded' && !!payRow?.stripe_charge_id);

// -- lifecycle to in_progress + set job total ---------------------------------------
for (const status of ['confirmed', 'en_route', 'in_progress'])
  await admin.from('appointments').update({ status }).eq('id', dep.appointmentId);
await admin.from('appointments').update({ job_total_cents: 30000 }).eq('id', dep.appointmentId);

// -- final: off-session auto-charge (consent was given) ------------------------------
const finRes = await fetch(`${BASE}/api/payments/final`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.SUPABASE_DB_WEBHOOK_SECRET ?? 'local-dev-hook-secret' },
  body: JSON.stringify({ appointmentId: dep.appointmentId }),
});
const fin = await finRes.json();
ok('final endpoint 200 + charged', finRes.status === 200 && fin.status === 'charged', JSON.stringify(fin));

let appt;
for (let i = 0; i < 20; i++) {
  await sleep(1000);
  ({ data: appt } = await admin.from('appointments').select('status').eq('id', dep.appointmentId).single());
  if (appt?.status === 'closed') break;
}
ok('appointment completed → closed after final webhook', appt?.status === 'closed', appt?.status);
const { data: finRow } = await admin.from('payments').select('amount_cents, status')
  .eq('appointment_id', dep.appointmentId).eq('kind', 'final').single();
ok('final charge = 30000 − 7500 = 22500', finRow?.amount_cents === 22500 && finRow?.status === 'succeeded');

// -- promo code (created via API, validated via endpoint) -----------------------------
const coupon = await stripe.coupons.create({ percent_off: 10, duration: 'once' });
const code = `VOLT10-${rand}`.toUpperCase();
await stripe.promotionCodes.create({ promotion: { type: 'coupon', coupon: coupon.id }, code });
const promoRes = await fetch(`${BASE}/api/payments/validate-promo`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code }),
});
const promo = await promoRes.json();
ok('promo valid, 10% of $150 = $15 off', promo.valid === true && promo.discountCents === 1500, JSON.stringify(promo));
const bad = await (await fetch(`${BASE}/api/payments/validate-promo`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'NOPE-XYZ' }),
})).json();
ok('bogus promo invalid', bad.valid === false);

console.log('\nDone. Also run the manual checks in the doc (cancel/refund, decline fallback).');
```

Run with:

```bash
export STRIPE_SECRET_KEY=sk_test_...   # same value as .env.local
node /tmp/pikavolt-money-e2e.mjs
```

## 3. Manual checks (UI, ~5 minutes)

1. **Cancel ≥24h → refund**: book a slot ≥2 days out through `/book` (test card
   `4242 4242 4242 4242`), then on `/appointments/[id]` click *Cancel
   appointment*. Expect the "deposit will be refunded in full" copy, then:
   - `payments` row for the deposit → `refunded`;
   - a refund on the PaymentIntent in the Stripe sandbox dashboard;
   - cancellation email (noop-logged unless `RESEND_API_KEY` set).
2. **Cancel <24h → forfeit**: book tomorrow's earliest slot, cancel — expect
   the "will not be refunded" copy and **no** Stripe refund.
3. **Off-session decline fallback**: book with auto-charge consent using
   `4000 0000 0000 0341` (attaches, then declines off-session). Drive to
   `in_progress`, set `job_total_cents`, POST `/api/payments/final` — expect
   `{"status":"payment_link_sent"}`, a `final_payment_due` email/push
   (noop-logged), and a working Payment Element on `/appointments/[id]/pay`.
4. **Browser deposit flow**: with the real publishable key, walk `/book`
   end-to-end and pay inside the Payment Element (appearance should be
   volt-on-dark).

## 4. What is already verified without Stripe

`69/69` checks pass in the offline suite (see WS-B report): pricing paths,
webhook signature verification + event routing + idempotency (signed locally
with `STRIPE_WEBHOOK_SECRET`), slot computation against seeded hours,
double-book exclusion (23P01), 503 guards, cancel flow under RLS + transition
trigger, cron expiry, addresses CRUD, and all customer pages.
