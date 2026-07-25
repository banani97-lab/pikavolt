import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/components/admin/ownerGuard';

/** CSV field escaping per RFC 4180. */
function csvField(value: string | null | undefined): string {
  const s = value ?? '';
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Owner-only CSV export of a sweepstakes' entries.
 * Lives under /admin so the middleware gate also applies; requireOwner is a
 * defense-in-depth second check.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: sweep }, { data: entries, error }] = await Promise.all([
    supabase.from('sweepstakes').select('title').eq('id', id).maybeSingle(),
    supabase
      .from('sweepstakes_entries')
      .select('full_name, email, phone, zip, created_at, user_id')
      .eq('sweepstakes_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sweep) return NextResponse.json({ error: 'Sweepstakes not found.' }, { status: 404 });

  const header = 'full_name,email,phone,zip,entered_at,registered_user';
  const lines = ((entries ?? []) as {
    full_name: string;
    email: string;
    phone: string | null;
    zip: string | null;
    created_at: string;
    user_id: string | null;
  }[]).map((e) =>
    [
      csvField(e.full_name),
      csvField(e.email),
      csvField(e.phone),
      csvField(e.zip),
      csvField(e.created_at),
      e.user_id ? 'yes' : 'no',
    ].join(','),
  );

  const csv = [header, ...lines].join('\r\n') + '\r\n';
  const slug = String(sweep.title ?? 'sweepstakes')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${slug || 'sweepstakes'}-entries.csv"`,
      'cache-control': 'no-store',
    },
  });
}
