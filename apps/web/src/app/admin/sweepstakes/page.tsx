import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SweepstakesForm } from '@/components/admin/SweepstakesManager';
import { fmtDate } from '@/components/admin/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Sweepstakes' };
export const dynamic = 'force-dynamic';

interface SweepRow {
  id: string;
  title: string;
  prize: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  drawn_at: string | null;
  winner_entry_id: string | null;
}

export default async function AdminSweepstakesPage() {
  const supabase = await createClient();
  const [{ data: sweepsData }, { data: entriesData }] = await Promise.all([
    supabase
      .from('sweepstakes')
      .select('id, title, prize, starts_at, ends_at, is_active, drawn_at, winner_entry_id')
      .order('created_at', { ascending: false }),
    supabase.from('sweepstakes_entries').select('sweepstakes_id'),
  ]);

  const sweeps = (sweepsData ?? []) as SweepRow[];
  const counts = new Map<string, number>();
  for (const e of (entriesData ?? []) as { sweepstakes_id: string }[]) {
    counts.set(e.sweepstakes_id, (counts.get(e.sweepstakes_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
          Sweepstakes
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Giveaways with public entry forms on the marketing site.
        </p>
      </div>

      <SweepstakesForm initial={null} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sweeps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-surface/50 p-8 text-center text-sm text-zinc-500 lg:col-span-2">
            No sweepstakes yet.
          </div>
        ) : (
          sweeps.map((s) => (
            <Link
              key={s.id}
              href={`/admin/sweepstakes/${s.id}`}
              className="rounded-xl border border-white/10 bg-surface p-5 transition-colors hover:border-volt/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg uppercase tracking-wide text-white">
                    {s.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-zinc-400">{s.prize ?? 'No prize listed'}</p>
                </div>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-xs font-semibold',
                    s.is_active
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                      : 'border-white/15 bg-white/5 text-zinc-500',
                  )}
                >
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-300">
                  <Users className="h-3.5 w-3.5 text-volt" />
                  {counts.get(s.id) ?? 0} entries
                </span>
                <span>
                  {s.starts_at ? fmtDate(s.starts_at) : 'open start'} →{' '}
                  {s.ends_at ? fmtDate(s.ends_at) : 'open end'}
                </span>
                {s.winner_entry_id && (
                  <span className="inline-flex items-center gap-1 font-semibold text-volt">
                    <Trophy className="h-3.5 w-3.5" /> Winner drawn{' '}
                    {s.drawn_at ? fmtDate(s.drawn_at) : ''}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
