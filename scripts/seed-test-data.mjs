#!/usr/bin/env node
/**
 * Local-dev TEST DATA seeding for the admin dashboard (WS-C).
 *
 * Creates two test customers with addresses, a spread of appointments in
 * various lifecycle statuses (with payments), a chat conversation with
 * unread messages, a blocked slot, and sweepstakes entries.
 *
 * Idempotent: re-running wipes and recreates the test customers' data.
 * Run from the repo root:  node scripts/seed-test-data.mjs
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TZ = 'America/New_York';

/** 'YYYY-MM-DD' for (today + dayOffset) in the business timezone. */
function etDay(dayOffset) {
  const d = new Date(Date.now() + dayOffset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** ISO timestamp for hour:minute (ET) on today+dayOffset. */
function etTime(dayOffset, hour, minute = 0) {
  const day = etDay(dayOffset);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  // Start from the same wall-clock instant in UTC, then shift by the zone's
  // real UTC offset (computed via Intl parts — machine-TZ independent).
  const guess = new Date(`${day}T${hh}:${mm}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(guess);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const etWallAsUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'),
  );
  const offsetMs = guess.getTime() - etWallAsUtc; // e.g. +4h during EDT
  return new Date(guess.getTime() + offsetMs).toISOString();
}

async function ensureUser(email, fullName, phone) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: 'pikavolt-dev-1', email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  let id;
  if (error) {
    const { data: list, error: e2 } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
    if (e2) throw e2;
    const u = list.users.find((u) => u.email === email);
    if (!u) throw error;
    id = u.id;
  } else {
    id = data.user.id;
  }
  const { error: pe } = await supabase
    .from('profiles')
    .upsert({ id, role: 'customer', full_name: fullName, email, phone });
  if (pe) throw pe;
  return id;
}

async function insert(table, rows) {
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function main() {
  const ali = await ensureUser('ali.customer@example.com', 'Ali Hassan', '(614) 555-0134');
  const jess = await ensureUser('jess.customer@example.com', 'Jess Miller', '(740) 555-0188');
  console.log('customers:', ali, jess);

  // Wipe previous test data for these customers (idempotency).
  const { data: oldAppts } = await supabase
    .from('appointments').select('id').in('customer_id', [ali, jess]);
  const oldIds = (oldAppts ?? []).map((a) => a.id);
  if (oldIds.length) {
    await supabase.from('payments').delete().in('appointment_id', oldIds);
    await supabase.from('appointments').delete().in('id', oldIds);
  }
  await supabase.from('conversations').delete().in('customer_id', [ali, jess]);
  await supabase.from('addresses').delete().in('user_id', [ali, jess]);
  await supabase.from('blocked_slots').delete().eq('reason', '[test] Lunch break');

  const [aliAddr] = await insert('addresses', [{
    user_id: ali, label: 'Home', line1: '412 Volt Ln', city: 'Dublin', state: 'OH',
    zip: '43017', property_type: 'residential', is_default: true,
  }]);
  const [jessAddr] = await insert('addresses', [{
    user_id: jess, label: 'Barn', line1: '9800 Storm Rd', city: 'Marysville', state: 'OH',
    zip: '43040', property_type: 'agricultural', is_default: true,
  }]);

  // A couple of services to attach.
  const { data: services } = await supabase.from('services').select('id, name').limit(3);

  const mk = (customer, addr, dayOff, startH, endH, status, extra = {}) => ({
    customer_id: customer, address_id: addr, status,
    scheduled_start: etTime(dayOff, startH), scheduled_end: etTime(dayOff, endH),
    auto_charge_consent: true, terms_accepted_at: new Date().toISOString(),
    ...extra,
  });

  const appts = await insert('appointments', [
    mk(ali, aliAddr.id, 0, 9, 11, 'confirmed', { description: 'Panel upgrade quote — 200A service' }),
    mk(jess, jessAddr.id, 0, 13, 15, 'requested', { description: 'Barn lighting flickering, breaker trips' }),
    mk(ali, aliAddr.id, 0, 16, 18, 'in_progress', { description: 'EV charger install, garage wall' }),
    mk(ali, aliAddr.id, -3, 9, 11, 'completed', {
      description: 'Hot tub circuit', job_total_cents: 42000,
      job_notes: 'Ran 50A GFCI circuit, all tested.', completed_at: etTime(-3, 11),
    }),
    mk(jess, jessAddr.id, -2, 13, 15, 'completed', {
      description: 'Well pump wiring repair', job_total_cents: 30000,
      job_notes: 'Replaced corroded feeder.', completed_at: etTime(-2, 15),
    }),
    mk(jess, jessAddr.id, 1, 10, 12, 'requested', { description: 'Arena lighting estimate' }),
    mk(ali, aliAddr.id, -7, 9, 11, 'cancelled', { cancelled_reason: 'Customer travelling' }),
  ]);
  console.log('appointments:', appts.length);

  // Attach services to the first appointment.
  if (services?.length) {
    await insert('appointment_services', [
      { appointment_id: appts[0].id, service_id: services[0].id },
      { appointment_id: appts[0].id, service_id: services[1].id, custom_note: 'Also check attic junction box' },
    ]);
  }

  // Payments: deposits everywhere sensible; final only for appts[3].
  const paidAt = (dayOff) => etTime(dayOff, 12);
  await insert('payments', [
    { appointment_id: appts[0].id, kind: 'deposit', amount_cents: 7500, status: 'succeeded', paid_at: paidAt(0), stripe_payment_intent_id: 'pi_test_seed_dep_1' },
    { appointment_id: appts[2].id, kind: 'deposit', amount_cents: 7500, status: 'succeeded', paid_at: paidAt(0), stripe_payment_intent_id: 'pi_test_seed_dep_2' },
    { appointment_id: appts[3].id, kind: 'deposit', amount_cents: 7500, status: 'succeeded', paid_at: paidAt(-3), stripe_payment_intent_id: 'pi_test_seed_dep_3' },
    { appointment_id: appts[3].id, kind: 'final', amount_cents: 34500, status: 'succeeded', paid_at: paidAt(-3), stripe_payment_intent_id: 'pi_test_seed_fin_3' },
    { appointment_id: appts[4].id, kind: 'deposit', amount_cents: 7500, status: 'succeeded', paid_at: paidAt(-2), stripe_payment_intent_id: 'pi_test_seed_dep_4' },
    { appointment_id: appts[4].id, kind: 'final', amount_cents: 22500, status: 'pending', stripe_payment_intent_id: 'pi_test_seed_fin_4' },
  ]);

  // Chat: conversation with unread customer messages (trigger bumps owner_unread).
  const [conv] = await insert('conversations', [{ customer_id: ali, status: 'open' }]);
  await insert('messages', [
    { conversation_id: conv.id, sender_id: ali, sender_role: 'customer', body: 'Hey — can you come earlier tomorrow?' },
    { conversation_id: conv.id, sender_id: ali, sender_role: 'customer', body: 'Also, do you install smart panels?' },
  ]);

  // Blocked slot today.
  await insert('blocked_slots', [{
    starts_at: etTime(0, 11, 30), ends_at: etTime(0, 12, 30), reason: '[test] Lunch break',
  }]);

  // Sweepstakes entries on the seeded sweepstakes.
  const { data: sweeps } = await supabase.from('sweepstakes').select('id').limit(1);
  if (sweeps?.length) {
    const sid = sweeps[0].id;
    const { error } = await supabase.from('sweepstakes_entries').upsert(
      [
        { sweepstakes_id: sid, full_name: 'Ali Hassan', email: 'ali.customer@example.com', zip: '43017', user_id: ali },
        { sweepstakes_id: sid, full_name: 'Jess Miller', email: 'jess.customer@example.com', zip: '43040', user_id: jess },
        { sweepstakes_id: sid, full_name: 'Sam Reed', email: 'sam.reed@example.com', zip: '43065' },
        { sweepstakes_id: sid, full_name: 'Dana Fox', email: 'dana.fox@example.com', zip: '43015' },
        { sweepstakes_id: sid, full_name: 'Omar Khan', email: 'omar.khan@example.com', zip: '43026' },
      ],
      { onConflict: 'sweepstakes_id,email' },
    );
    if (error) throw error;
    console.log('sweepstakes entries seeded on', sid);
  }

  console.log('Test data ready.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
