#!/usr/bin/env node
/**
 * Live-tracking simulator / demo tool (WS-F).
 *
 * Plays the role of the owner's Flutter app: picks (or creates) an en_route
 * appointment for the seeded customer Ali, gives the address real coordinates,
 * creates the tracking_session row, signs in as the owner, and streams fake
 * GPS pings over the private Supabase broadcast channel
 * `tracking:{appointment_id}` (event `ping`, FROZEN payload
 * {lat, lng, heading, speed, ts}) along a line toward the destination.
 * Every 5th ping it upserts the tracking_sessions snapshot (what late
 * joiners read on mount), then marks the session ended on arrival.
 *
 * Prereqs: local Supabase running, `node scripts/create-owner.mjs` and
 * `node scripts/seed-test-data.mjs` already run, web dev server on :3000
 * if you want to watch the appointment page while it drives.
 *
 * Run from the repo root:  node scripts/simulate-tracking.mjs
 * Env overrides: SIM_PINGS (default 20), SIM_INTERVAL_MS (default 3000),
 *                SIM_KEEP_SESSION=1 to skip marking arrived at the end.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(here, '..', 'apps', 'web');
const require = createRequire(path.join(webDir, 'package.json'));
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...loadEnvFile(path.join(webDir, '.env.local')), ...process.env };
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / anon / service role).');
  process.exit(1);
}

const PINGS = Math.max(2, Number(env.SIM_PINGS) || 20);
const INTERVAL_MS = Math.max(100, Number(env.SIM_INTERVAL_MS) || 3000);

const OWNER_EMAIL = 'owner@pikavolt.local';
const OWNER_PASSWORD = 'pikavolt-dev-1';
const CUSTOMER_EMAIL = 'ali.customer@example.com';

/** Destination: Ali's seeded address (412 Volt Ln, Dublin OH) — real coords. */
const DEST = { lat: 40.0992, lng: -83.1141 };
/** Start ~5.5 km SE of the destination (heading roughly NW into Dublin). */
const START = { lat: DEST.lat - 0.04, lng: DEST.lng + 0.035 };

const service = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function bearingDeg(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function haversineMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
}

async function findProfileId(email) {
  const { data, error } = await service.from('profiles').select('id').eq('email', email).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Find/repurpose/create an en_route appointment for the customer. */
async function ensureEnRouteAppointment(customerId) {
  // Give the customer's default address the destination coordinates.
  const { data: addr, error: addrErr } = await service
    .from('addresses')
    .select('id')
    .eq('user_id', customerId)
    .eq('is_default', true)
    .maybeSingle();
  if (addrErr) throw addrErr;
  if (!addr) throw new Error(`No default address for ${CUSTOMER_EMAIL} — run scripts/seed-test-data.mjs`);
  await service.from('addresses').update({ lat: DEST.lat, lng: DEST.lng }).eq('id', addr.id);

  // Already en_route?
  const { data: enRoute } = await service
    .from('appointments')
    .select('id, status')
    .eq('customer_id', customerId)
    .eq('status', 'en_route')
    .limit(1)
    .maybeSingle();
  if (enRoute) return enRoute.id;

  // A confirmed one we can legally flip (confirmed → en_route)?
  const { data: confirmed } = await service
    .from('appointments')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'confirmed')
    .limit(1)
    .maybeSingle();
  if (confirmed) {
    const { error } = await service
      .from('appointments')
      .update({ status: 'en_route' })
      .eq('id', confirmed.id);
    if (error) throw error;
    return confirmed.id;
  }

  // Create a fresh one far in the future (avoids the no-overlap constraint);
  // inserts are not gated by the status state machine (it fires on UPDATE).
  const start = new Date(Date.now() + 45 * 86400000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 3600000);
  const { data: created, error } = await service
    .from('appointments')
    .insert({
      customer_id: customerId,
      address_id: addr.id,
      status: 'en_route',
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      description: '[sim] Live tracking demo appointment',
      auto_charge_consent: true,
      terms_accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

async function upsertSnapshot(appointmentId, fields) {
  const { error } = await service
    .from('tracking_sessions')
    .upsert({ appointment_id: appointmentId, ...fields }, { onConflict: 'appointment_id' });
  if (error) throw error;
}

async function main() {
  const customerId = await findProfileId(CUSTOMER_EMAIL);
  if (!customerId) {
    console.error(`Customer ${CUSTOMER_EMAIL} not found — run: node scripts/seed-test-data.mjs`);
    process.exit(1);
  }

  const appointmentId = await ensureEnRouteAppointment(customerId);
  console.log(`appointment: ${appointmentId} (en_route)`);
  console.log(`watch it at: http://localhost:3000/appointments/${appointmentId}`);

  // Fresh tracking session (restart if a previous run ended it).
  await upsertSnapshot(appointmentId, {
    started_at: new Date().toISOString(),
    ended_at: null,
    last_lat: START.lat,
    last_lng: START.lng,
    last_heading: bearingDeg(START, DEST),
    last_ping_at: new Date().toISOString(),
    eta_seconds: null,
    eta_updated_at: null,
  });
  console.log('tracking session started');

  // Owner client — pings must pass the realtime broadcast RLS as the owner.
  const owner = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: auth, error: authErr } = await owner.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (authErr || !auth.session) {
    console.error(`Owner sign-in failed (${authErr?.message}) — run: node scripts/create-owner.mjs`);
    process.exit(1);
  }
  // Restored/programmatic sessions are not auto-forwarded to realtime.
  await owner.realtime.setAuth(auth.session.access_token);

  const channel = owner.channel(`tracking:${appointmentId}`, {
    config: { private: true, broadcast: { ack: true } },
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('channel subscribe timed out')), 10000);
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(err ?? new Error(`channel status ${status}`));
      }
    });
  });
  console.log(`subscribed to tracking:${appointmentId} — streaming ${PINGS} pings @ ${INTERVAL_MS}ms`);

  const heading = bearingDeg(START, DEST);
  for (let i = 0; i < PINGS; i++) {
    // Progress 0..1 with the last ping exactly at the destination.
    const t = i / (PINGS - 1);
    const lat = START.lat + (DEST.lat - START.lat) * t;
    const lng = START.lng + (DEST.lng - START.lng) * t;
    // Realistic driving speed (~35 mph), independent of the sim's compressed
    // timeline, with a little jitter so the UI readout moves.
    const speed = 15.6 + Math.sin(i * 1.7) * 3;

    /** FROZEN ping contract. */
    const payload = {
      lat,
      lng,
      heading: i === PINGS - 1 ? null : heading,
      speed: i === PINGS - 1 ? 0 : Number(Math.max(2, speed).toFixed(1)),
      ts: new Date().toISOString(),
    };
    const status = await channel.send({ type: 'broadcast', event: 'ping', payload });
    const remaining = haversineMeters({ lat, lng }, DEST);
    console.log(
      `ping ${String(i + 1).padStart(2)}/${PINGS} ${lat.toFixed(5)},${lng.toFixed(5)} ` +
        `(${(remaining / 1609.344).toFixed(2)} mi to go) → ${status}`,
    );

    // Snapshot upsert every 5 pings (matches the Flutter app's cadence).
    if ((i + 1) % 5 === 0 || i === PINGS - 1) {
      await upsertSnapshot(appointmentId, {
        last_lat: lat,
        last_lng: lng,
        last_heading: payload.heading,
        last_ping_at: payload.ts,
      });
      console.log('  snapshot upserted');
    }

    if (i < PINGS - 1) await sleep(INTERVAL_MS);
  }

  if (env.SIM_KEEP_SESSION === '1') {
    console.log('SIM_KEEP_SESSION=1 — leaving the session active');
  } else {
    await upsertSnapshot(appointmentId, { ended_at: new Date().toISOString() });
    console.log('arrived — tracking session ended');
  }

  await owner.removeChannel(channel);
  await owner.auth.signOut();
  console.log('done');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
