# External Setup Checklist (Human Required)

Accounts, keys, and approvals that must be set up by a human before launch.
Work top to bottom; items marked **(blocking)** gate a launch-critical feature.

## 1. Supabase (hosted project) **(blocking)**

- [ ] Create a Supabase project (org: Pikavolt LLC), region closest to Ohio (`us-east-1`/`us-east-2`).
- [ ] Link the repo: `cd packages/db && npx supabase@latest link --project-ref <ref>`, then `npx supabase@latest db push`.
- [ ] Auth → Providers: enable **Google** (needs OAuth client ID/secret from Google Cloud, step 3).
- [ ] Auth → Providers: enable **Anonymous sign-ins** (used for guest chat/booking flows).
- [ ] Database → Webhooks: enable DB webhooks (used for notification fan-out on `appointments`/`messages`).
- [ ] Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` into Vercel env vars (step 7). Never expose the service role key client-side.

## 2. Stripe **(blocking)**

- [ ] Create Stripe account for Pikavolt LLC; complete business verification (EIN, bank account).
- [ ] Set statement descriptor: **PIKAVOLT ELECTRIC**.
- [ ] Copy publishable + secret keys (test AND live) into env vars.
- [ ] Create a webhook endpoint pointing at the app's `/api/stripe/webhook`; copy the **webhook signing secret** into env vars. Subscribe at minimum to: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `customer.created`.
- [ ] Enable saved cards (off-session payments) — required for the 50% auto-charge-on-completion flow with the booking consent checkbox.

## 3. Google Cloud

- [ ] Create project `pikavolt` and enable billing.
- [ ] Enable APIs: **Maps JavaScript API**, **Maps SDK for iOS**, **Maps SDK for Android**, **Geocoding API**, **Routes API**.
- [ ] Create **3 restricted API keys**:
  - Web key — HTTP-referrer restricted to the production domain(s); Maps JS + Geocoding.
  - iOS key — bundle-id restricted to `com.pikavolt.app`; Maps SDK for iOS.
  - Android key — package-name + SHA-1 restricted; Maps SDK for Android.
  - Routes/Geocoding server calls: use a 4th server-side key or restrict by IP — never ship the server key to clients.
- [ ] OAuth consent screen (external) + **OAuth client IDs** for Web, iOS, and Android (for Google sign-in via Supabase Auth). Paste web client ID/secret into Supabase (step 1).

## 4. Firebase (push notifications)

- [ ] Create a Firebase project (can attach to the Google Cloud project above).
- [ ] Register iOS app (`com.pikavolt.app`) → download `GoogleService-Info.plist`.
- [ ] Register Android app (`com.pikavolt.app`) → download `google-services.json`.
- [ ] Register a web app → copy the FCM web config + generate a **VAPID key pair** for web push.
- [ ] Apple push: create an **APNs auth key (.p8)** in the Apple Developer portal and upload it to Firebase Cloud Messaging settings (key ID + team ID).
- [ ] Generate a **Firebase Admin service account JSON** (Project settings → Service accounts) for server-side sends; store as an env secret, never in the repo.

## 5. App store accounts

- [ ] Apple Developer Program — **$99/year**. Register bundle ID `com.pikavolt.app`, create APNs key (step 4).
- [ ] Google Play Console — **$25 one-time**. Register package `com.pikavolt.app`.

## 6. Domain + Vercel

- [ ] Purchase/verify the production domain (e.g. `pikavolt.com`) and point DNS at Vercel.
- [ ] Create the Vercel project for `apps/web`; add domains (apex + `www`).
- [ ] Set env vars (production + preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `RESEND_API_KEY`, `FIREBASE_ADMIN_CREDENTIALS` (see repo `.env.example`).

## 7. Resend (transactional email)

- [ ] Create Resend account; add the sending domain.
- [ ] Add the **DKIM** (and SPF/return-path) DNS records Resend provides; verify the domain before sending.
- [ ] Copy `RESEND_API_KEY` into env vars.

## 8. Twilio (SMS — post-launch)

- [ ] Create Twilio account and buy a local Ohio number.
- [ ] Complete **A2P 10DLC** brand + campaign registration (takes days-to-weeks; start early even though SMS ships post-launch).

## 9. Content & legal (owner action)

- [ ] **Logo**: owner has not supplied one — a placeholder bolt mark is in use. Need final SVG (light + dark variants).
- [ ] **Owner phone number**: seed data uses placeholder `+1 614 555 0199`. Replace `emergency_phone` in `app_settings` (and any marketing copy) with the real 24/7 number before launch.
- [ ] **Sweepstakes official rules**: must be drafted/reviewed by an attorney (state sweepstakes law compliance) before any live drawing. The seeded sample sweepstakes is inactive; keep it inactive until rules are approved.
