import { NextResponse } from 'next/server';

import { createApiClient } from '@/lib/supabase/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/account/delete — permanently delete the signed-in user's account.
 *
 * Serves both surfaces: web sends the session as a cookie, the Flutter app as
 * `Authorization: Bearer <token>` (see createApiClient). The user to delete is
 * ALWAYS derived from the authenticated session — no id is accepted from the
 * body — so a caller can only ever delete their own account.
 *
 * Required for App Store Guideline 5.1.1(v) / Play account-deletion policy:
 * account creation must be matched by in-app account deletion.
 *
 * Deletion order is dictated by the FK graph (see 0001_init.sql):
 *  1. payments      — references appointments with NO cascade, so must go first
 *  2. appointments  — cascades appointment_services, appointment_events,
 *                     tracking_sessions; also clears the customer_id/address_id
 *                     FKs that would otherwise block the auth-user delete
 *  3. auth user     — cascades profiles → addresses, conversations → messages,
 *                     device_tokens; nulls sweepstakes_entries.user_id
 *
 * Stripe remains the system of record for payment/tax history, so removing the
 * local operational rows here loses no financial/audit data.
 */
export async function POST() {
  const supabase = await createApiClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = createAdminClient();
  const userId = user.id;

  // 1. Find the user's appointments and drop their payments first (payments →
  //    appointments has no ON DELETE cascade).
  const { data: appts, error: apptSelErr } = await admin
    .from('appointments')
    .select('id')
    .eq('customer_id', userId);
  if (apptSelErr) {
    console.error('[api/account/delete] appointment lookup failed', apptSelErr);
    return NextResponse.json({ error: 'Could not delete account data' }, { status: 500 });
  }

  const appointmentIds = (appts ?? []).map((a) => a.id);
  if (appointmentIds.length > 0) {
    const { error: payErr } = await admin
      .from('payments')
      .delete()
      .in('appointment_id', appointmentIds);
    if (payErr) {
      console.error('[api/account/delete] payments delete failed', payErr);
      return NextResponse.json({ error: 'Could not delete account data' }, { status: 500 });
    }

    // 2. Delete the appointments (cascades services, events, tracking sessions).
    const { error: apptDelErr } = await admin
      .from('appointments')
      .delete()
      .eq('customer_id', userId);
    if (apptDelErr) {
      console.error('[api/account/delete] appointments delete failed', apptDelErr);
      return NextResponse.json({ error: 'Could not delete account data' }, { status: 500 });
    }
  }

  // 3. Delete the auth user — the actual account removal. Cascades the profile
  //    and all remaining personal rows.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error('[api/account/delete] auth deleteUser failed', delErr);
    return NextResponse.json({ error: 'Could not delete account' }, { status: 500 });
  }

  // Best-effort: clear the web cookie session. The mobile client signs out
  // locally. Either way the JWT now points at a deleted user and is dead.
  await supabase.auth.signOut().catch(() => {});

  return NextResponse.json({ ok: true });
}
