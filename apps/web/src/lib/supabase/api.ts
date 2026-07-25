import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

import { createClient } from './server';

/**
 * Supabase client for API Route Handlers that serve BOTH the web app and the
 * Flutter app. Web sends the session via cookies; mobile sends
 * `Authorization: Bearer <supabase access token>`. Bearer wins when present.
 *
 * The returned client is authenticated as the caller (RLS applies normally).
 */
export async function createApiClient() {
  const headerStore = await headers();
  const authorization = headerStore.get('authorization');

  if (authorization?.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice(7).trim();
    return createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }

  return createClient();
}
