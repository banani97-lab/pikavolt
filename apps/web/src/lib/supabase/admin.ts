import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client — bypasses RLS.
 *
 * SERVER ONLY. Never import from client components; the service-role key
 * must never reach the browser. Use in route handlers, server actions, and
 * webhooks (e.g. Stripe, Supabase DB hooks).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot create admin client.',
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
