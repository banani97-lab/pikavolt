#!/usr/bin/env node
/**
 * Local-dev owner seeding script.
 *
 * Creates (idempotently) the auth user owner@pikavolt.local with password
 * 'pikavolt-dev-1', and promotes its profile to role='owner' with
 * full_name 'Fares'. Uses the service-role key against the local stack.
 *
 * Run from the repo root:  node scripts/create-owner.mjs
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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const OWNER_EMAIL = 'owner@pikavolt.local';
export const OWNER_PASSWORD = 'pikavolt-dev-1';

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function main() {
  let userId;
  const { data, error } = await supabase.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Fares' },
  });

  if (error) {
    const existing = await findUserByEmail(OWNER_EMAIL);
    if (!existing) throw error;
    userId = existing.id;
    const { error: pwErr } = await supabase.auth.admin.updateUserById(userId, {
      password: OWNER_PASSWORD,
      email_confirm: true,
    });
    if (pwErr) throw pwErr;
    console.log(`Owner user already existed — password reset (${userId})`);
  } else {
    userId = data.user.id;
    console.log(`Owner user created (${userId})`);
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, role: 'owner', full_name: 'Fares', email: OWNER_EMAIL });
  if (profileErr) throw profileErr;

  console.log(`Profile set: role=owner, full_name=Fares`);
  console.log(`Sign in at /login with ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
