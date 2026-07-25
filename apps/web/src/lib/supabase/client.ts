'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for Client Components (browser).
 * Call inside components/handlers — not at module top level — so pages can
 * still prerender when env vars are absent.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
