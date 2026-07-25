import { NextResponse } from 'next/server';
import { sendPushToOwner } from '@/lib/notify/push';

export const dynamic = 'force-dynamic';

/**
 * POST /api/hooks/booking-created — Supabase DB webhook target.
 *
 * Kept intentionally thin: booking emails + the deposit-paid owner push are
 * handled by the Stripe webhook; this hook just gives the owner an instant
 * heads-up that a booking request landed (before the deposit settles).
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-webhook-secret');
  if (!secret || secret !== process.env.SUPABASE_DB_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  let record: { id?: string } | undefined;
  try {
    const body = (await request.json()) as { record?: { id?: string } };
    record = body.record;
  } catch {
    // tolerate empty/odd bodies — the push is best-effort
  }

  await sendPushToOwner({
    type: 'new_booking',
    title: 'New booking request',
    body: 'A customer just requested a service call.',
    data: record?.id ? { appointmentId: record.id } : undefined,
  });

  return NextResponse.json({ ok: true });
}
