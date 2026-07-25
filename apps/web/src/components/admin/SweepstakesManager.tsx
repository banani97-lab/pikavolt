'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Loader2, Trophy } from 'lucide-react';
import {
  createSweepstakes,
  updateSweepstakes,
  type SweepstakesInput,
} from '@/app/admin/sweepstakes/actions';
import { cn } from '@/lib/utils';

type Msg = { kind: 'error' | 'info'; text: string } | null;

export interface SweepstakesFormValues {
  id?: string;
  title: string;
  description: string;
  prize: string;
  rulesUrl: string;
  startsAt: string; // yyyy-mm-dd or ''
  endsAt: string;
  isActive: boolean;
}

export function SweepstakesForm({ initial }: { initial: SweepstakesFormValues | null }) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [values, setValues] = useState<SweepstakesFormValues>(
    initial ?? {
      title: '',
      description: '',
      prize: '',
      rulesUrl: '',
      startsAt: '',
      endsAt: '',
      isActive: true,
    },
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Msg>(null);

  const set = (patch: Partial<SweepstakesFormValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  const submit = () => {
    setMessage(null);
    const input: SweepstakesInput = {
      title: values.title,
      description: values.description,
      prize: values.prize,
      rulesUrl: values.rulesUrl,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      isActive: values.isActive,
    };
    startTransition(async () => {
      const result = initial?.id
        ? await updateSweepstakes(initial.id, input)
        : await createSweepstakes(input);
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.error ?? 'Save failed.' });
        return;
      }
      setMessage({ kind: 'info', text: editing ? 'Sweepstakes updated.' : 'Sweepstakes created.' });
      if (!editing && result.id) {
        router.push(`/admin/sweepstakes/${result.id}`);
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg uppercase tracking-wide text-white">
        <Gift className="h-4 w-4 text-volt" />
        {editing ? 'Edit sweepstakes' : 'New sweepstakes'}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="sw-title" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Title
          </label>
          <input
            id="sw-title"
            value={values.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Free EV Charger Install Giveaway"
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sw-desc" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Description
          </label>
          <textarea
            id="sw-desc"
            rows={2}
            value={values.description}
            onChange={(e) => set({ description: e.target.value })}
            className="w-full rounded-lg border border-white/15 bg-storm p-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <div>
          <label htmlFor="sw-prize" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Prize
          </label>
          <input
            id="sw-prize"
            value={values.prize}
            onChange={(e) => set({ prize: e.target.value })}
            placeholder="Level 2 EV charger + install"
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <div>
          <label htmlFor="sw-rules" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Rules URL
          </label>
          <input
            id="sw-rules"
            value={values.rulesUrl}
            onChange={(e) => set({ rulesUrl: e.target.value })}
            placeholder="/sweepstakes/rules"
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <div>
          <label htmlFor="sw-starts" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Starts (optional)
          </label>
          <input
            id="sw-starts"
            type="date"
            value={values.startsAt}
            onChange={(e) => set({ startsAt: e.target.value })}
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <div>
          <label htmlFor="sw-ends" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Ends (optional)
          </label>
          <input
            id="sw-ends"
            type="date"
            value={values.endsAt}
            onChange={(e) => set({ endsAt: e.target.value })}
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <div className="flex items-center">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => set({ isActive: e.target.checked })}
              className="h-4 w-4 accent-volt"
            />
            Active (visible on the marketing site)
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={pending || !values.title.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-storm hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? 'Save changes' : 'Create sweepstakes'}
        </button>
        {message && (
          <span
            className={cn(
              'text-sm',
              message.kind === 'error' ? 'text-emergency' : 'text-emerald-400',
            )}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

export function DrawWinnerButton({
  sweepstakesId,
  entryCount,
  hasWinner,
}: {
  sweepstakesId: string;
  entryCount: number;
  hasWinner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draw = async () => {
    const prompt = hasWinner
      ? `Redraw the winner? This replaces the current winner (${entryCount} entries).`
      : `Draw a winner at random from ${entryCount} entries? This is done server-side and recorded immediately.`;
    if (!window.confirm(prompt)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/draw-winner', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sweepstakesId, redraw: hasWinner }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Draw failed (HTTP ${res.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error running the draw.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={draw}
        disabled={busy || entryCount === 0}
        className="inline-flex items-center gap-2 rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-storm hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
        {hasWinner ? 'Redraw winner' : 'Draw winner'}
      </button>
      {entryCount === 0 && <p className="mt-1 text-xs text-zinc-500">No entries yet.</p>}
      {error && <p className="mt-2 text-sm text-emergency">{error}</p>}
    </div>
  );
}
