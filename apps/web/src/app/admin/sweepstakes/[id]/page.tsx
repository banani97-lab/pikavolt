import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  SweepstakesForm,
  DrawWinnerButton,
  type SweepstakesFormValues,
} from '@/components/admin/SweepstakesManager';
import { fmtDateTime } from '@/components/admin/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Sweepstakes detail' };
export const dynamic = 'force-dynamic';

interface EntryRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  zip: string | null;
  created_at: string;
  user_id: string | null;
}

export default async function AdminSweepstakesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: sweep }, { data: entriesData }] = await Promise.all([
    supabase
      .from('sweepstakes')
      .select(
        'id, title, description, prize, rules_url, starts_at, ends_at, is_active, winner_entry_id, drawn_at',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('sweepstakes_entries')
      .select('id, full_name, email, phone, zip, created_at, user_id')
      .eq('sweepstakes_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (!sweep) notFound();

  const entries = (entriesData ?? []) as EntryRow[];
  const winner = sweep.winner_entry_id
    ? (entries.find((e) => e.id === sweep.winner_entry_id) ?? null)
    : null;

  const toDateInput = (iso: string | null) => (iso ? String(iso).slice(0, 10) : '');
  const formValues: SweepstakesFormValues = {
    id: sweep.id,
    title: sweep.title ?? '',
    description: sweep.description ?? '',
    prize: sweep.prize ?? '',
    rulesUrl: sweep.rules_url ?? '',
    startsAt: toDateInput(sweep.starts_at),
    endsAt: toDateInput(sweep.ends_at),
    isActive: Boolean(sweep.is_active),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/sweepstakes"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-volt"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All sweepstakes
        </Link>
        <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
          {sweep.title}
        </h1>
      </div>

      {/* Winner */}
      {winner ? (
        <div className="rounded-xl border border-volt/50 bg-volt/10 p-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 shrink-0 text-volt" aria-hidden="true" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-volt">
                Winner — drawn {fmtDateTime(sweep.drawn_at)}
              </div>
              <div className="font-display text-2xl uppercase tracking-wide text-white">
                {winner.full_name}
              </div>
              <div className="text-sm text-zinc-300">
                {winner.email}
                {winner.zip ? ` · ${winner.zip}` : ''}
                {winner.phone ? ` · ${winner.phone}` : ''}
              </div>
            </div>
          </div>
        </div>
      ) : sweep.winner_entry_id ? (
        <div className="rounded-xl border border-white/10 bg-surface p-4 text-sm text-zinc-400">
          A winner was drawn ({fmtDateTime(sweep.drawn_at)}) but the entry is no longer on file.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <DrawWinnerButton
          sweepstakesId={sweep.id}
          entryCount={entries.length}
          hasWinner={Boolean(sweep.winner_entry_id)}
        />
        <a
          href={`/admin/sweepstakes/${sweep.id}/entries.csv`}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-volt/60 hover:text-volt"
        >
          <Download className="h-4 w-4" /> Export entries CSV
        </a>
      </div>

      <SweepstakesForm initial={formValues} />

      {/* Entries */}
      <section>
        <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-white">
          Entries ({entries.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">ZIP</th>
                <th className="px-4 py-3 font-medium">Entered</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                    No entries yet.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr
                    key={e.id}
                    className={cn(
                      'transition-colors hover:bg-white/[0.03]',
                      e.id === sweep.winner_entry_id && 'bg-volt/[0.07]',
                    )}
                  >
                    <td className="px-4 py-3 font-semibold text-white">
                      {e.full_name}
                      {e.id === sweep.winner_entry_id && (
                        <Trophy className="ml-2 inline h-3.5 w-3.5 text-volt" aria-label="Winner" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{e.email}</td>
                    <td className="px-4 py-3 text-zinc-400">{e.zip ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-400">{fmtDateTime(e.created_at)}</td>
                    <td className="px-4 py-3">
                      {e.user_id ? (
                        <Link
                          href={`/admin/customers/${e.user_id}`}
                          className="text-xs font-semibold text-volt hover:underline"
                        >
                          Registered user
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-500">Public form</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
