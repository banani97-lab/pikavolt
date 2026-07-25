import { NextResponse } from 'next/server';
import { SlotsQuerySchema, type SlotsResponse } from '@pikavolt/core';
import { computeSlotsForDate } from '@/lib/appointments';

export const dynamic = 'force-dynamic';

/**
 * GET /api/slots?date=YYYY-MM-DD
 * Bookable slots for a calendar date (business timezone America/New_York),
 * computed from business_hours, blocked_slots, and non-cancelled appointments.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = SlotsQuerySchema.safeParse({ date: searchParams.get('date') ?? '' });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid date' },
      { status: 400 },
    );
  }

  try {
    const slots = await computeSlotsForDate(parsed.data.date);
    const body: SlotsResponse = { slots };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof RangeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[api/slots]', err);
    return NextResponse.json({ error: 'Failed to compute slots' }, { status: 500 });
  }
}
