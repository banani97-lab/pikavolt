import 'server-only';

import { createClient } from '@/lib/supabase/server';

export interface OwnerContext {
  userId: string;
}

/**
 * Owner check for /api/admin/* route handlers (the /admin middleware gate
 * does not cover /api paths). Returns null when the caller is not a
 * signed-in owner.
 */
export async function requireOwner(): Promise<OwnerContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'owner') return null;
  return { userId: user.id };
}
