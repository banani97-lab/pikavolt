import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface SessionResult {
  /** Response carrying any refreshed auth cookies — return (or copy cookies from) this. */
  response: NextResponse;
  user: User | null;
  /** Null when Supabase env vars are not configured (e.g. bare dev boot). */
  supabase: SupabaseClient | null;
}

/**
 * Refresh the Supabase auth session in middleware.
 * IMPORTANT: do not run code between createServerClient and auth.getUser() —
 * it can cause random logouts (see Supabase SSR docs).
 */
export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Env not configured — skip session handling so the app still boots.
    return { response, user: null, supabase: null };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}
