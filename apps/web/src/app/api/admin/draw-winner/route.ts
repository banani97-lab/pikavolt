import { randomInt } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { requireOwner } from '@/components/admin/ownerGuard';
import { createClient } from '@/lib/supabase/server';

/**
 * Owner-only sweepstakes winner draw.
 * Picks a uniformly random entry server-side (crypto.randomInt) and stamps
 * winner_entry_id + drawn_at. Pass { redraw: true } to overwrite an existing
 * winner. Uses the owner's RLS-scoped client (sweepstakes: owner all).
 */
export async function POST(request: NextRequest) {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { sweepstakesId?: string; redraw?: boolean };
  try {
    body = (await request.json()) as { sweepstakesId?: string; redraw?: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.sweepstakesId) {
    return NextResponse.json({ error: 'sweepstakesId is required' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: sweep } = await supabase
    .from('sweepstakes')
    .select('id, title, winner_entry_id, drawn_at')
    .eq('id', body.sweepstakesId)
    .maybeSingle();
  if (!sweep) return NextResponse.json({ error: 'Sweepstakes not found.' }, { status: 404 });

  if (sweep.winner_entry_id && !body.redraw) {
    return NextResponse.json(
      { error: 'A winner has already been drawn. Pass redraw to draw again.' },
      { status: 409 },
    );
  }

  const { data: entries, error: entriesError } = await supabase
    .from('sweepstakes_entries')
    .select('id, full_name, email, zip')
    .eq('sweepstakes_id', body.sweepstakesId);
  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });
  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: 'No entries to draw from.' }, { status: 400 });
  }

  const winner = entries[randomInt(entries.length)];
  if (!winner) return NextResponse.json({ error: 'Draw failed.' }, { status: 500 });

  const { error: updateError } = await supabase
    .from('sweepstakes')
    .update({ winner_entry_id: winner.id, drawn_at: new Date().toISOString() })
    .eq('id', body.sweepstakesId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    winner: {
      id: winner.id,
      fullName: winner.full_name,
      email: winner.email,
      zip: winner.zip,
    },
    totalEntries: entries.length,
  });
}
