import { NextResponse } from 'next/server';

import { notifyTechEnRoute } from '@/lib/appointments';
import { createApiClient } from '@/lib/supabase/api';

/**
 * Called by the mobile owner app right after it flips an appointment to
 * en_route (the "On My Way" tap updates Supabase directly, so it doesn't pass
 * through the web admin server action that would otherwise notify the customer).
 *
 * Auth: the caller must be the owner. We resolve them from their Supabase
 * session (bearer token) and confirm role='owner' under RLS before notifying —
 * the appointment row itself is read with the service role inside
 * notifyTechEnRoute, but we never notify on an unauthenticated request.
 */
export async function POST(request: Request) {
  const supabase = await createApiClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let appointmentId: unknown;
  try {
    ({ appointmentId } = await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (typeof appointmentId !== 'string') {
    return NextResponse.json({ error: 'appointmentId_required' }, { status: 400 });
  }

  await notifyTechEnRoute(appointmentId);
  return NextResponse.json({ ok: true });
}
