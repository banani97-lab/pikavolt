'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  saveBusinessHours,
  addBlockedSlot,
  deleteBlockedSlot,
  type DayHours,
} from '@/app/admin/availability/actions';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Msg = { kind: 'error' | 'info'; text: string } | null;

export function BusinessHoursEditor({ initial }: { initial: DayHours[] }) {
  const router = useRouter();
  const [days, setDays] = useState<DayHours[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Msg>(null);

  const update = (i: number, patch: Partial<DayHours>) => {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveBusinessHours(days);
      setMessage(
        result.ok
          ? { kind: 'info', text: 'Business hours saved.' }
          : { kind: 'error', text: result.error ?? 'Save failed.' },
      );
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-surface p-5">
      <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-white">
        Business hours
      </h2>
      <div className="space-y-2">
        {days.map((d, i) => (
          <div
            key={d.dayOfWeek}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-storm/50 px-3 py-2"
          >
            <label className="flex w-32 items-center gap-2 text-sm font-semibold text-white">
              <input
                type="checkbox"
                checked={d.isOpen}
                onChange={(e) => update(i, { isOpen: e.target.checked })}
                className="h-4 w-4 accent-volt"
              />
              {DAY_NAMES[d.dayOfWeek]}
            </label>
            {d.isOpen ? (
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="time"
                  value={d.opensAt}
                  onChange={(e) => update(i, { opensAt: e.target.value })}
                  className="h-9 rounded-lg border border-white/15 bg-storm px-2 text-sm text-white [color-scheme:dark]"
                  aria-label={`${DAY_NAMES[d.dayOfWeek]} opens at`}
                />
                <span className="text-zinc-500">to</span>
                <input
                  type="time"
                  value={d.closesAt}
                  onChange={(e) => update(i, { closesAt: e.target.value })}
                  className="h-9 rounded-lg border border-white/15 bg-storm px-2 text-sm text-white [color-scheme:dark]"
                  aria-label={`${DAY_NAMES[d.dayOfWeek]} closes at`}
                />
              </div>
            ) : (
              <span className="text-sm text-zinc-600">Closed</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-storm hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save hours
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

export interface BlockedSlotItem {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  label: string;
}

export function BlockedSlotsManager({ slots }: { slots: BlockedSlotItem[] }) {
  const router = useRouter();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Msg>(null);

  const add = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await addBlockedSlot(start, end, reason);
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.error ?? 'Failed to add block.' });
        return;
      }
      setStart('');
      setEnd('');
      setReason('');
      setMessage({ kind: 'info', text: 'Time blocked.' });
      router.refresh();
    });
  };

  const remove = (id: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteBlockedSlot(id);
      if (!result.ok) setMessage({ kind: 'error', text: result.error ?? 'Delete failed.' });
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-surface p-5">
      <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-white">
        Blocked time
      </h2>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-white/5 bg-storm/50 p-3">
        <div>
          <label htmlFor="block-start" className="mb-1 block text-xs font-medium text-zinc-400">
            From
          </label>
          <input
            id="block-start"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-9 rounded-lg border border-white/15 bg-storm px-2 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <div>
          <label htmlFor="block-end" className="mb-1 block text-xs font-medium text-zinc-400">
            To
          </label>
          <input
            id="block-end"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="h-9 rounded-lg border border-white/15 bg-storm px-2 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="block-reason" className="mb-1 block text-xs font-medium text-zinc-400">
            Reason
          </label>
          <input
            id="block-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vacation, supplier run…"
            className="h-9 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>
        <button
          onClick={add}
          disabled={pending || !start || !end}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-volt px-4 text-sm font-semibold text-storm hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Block
        </button>
      </div>

      {message && (
        <p
          className={cn(
            'mt-2 text-sm',
            message.kind === 'error' ? 'text-emergency' : 'text-emerald-400',
          )}
        >
          {message.text}
        </p>
      )}

      <ul className="mt-4 divide-y divide-white/5">
        {slots.length === 0 ? (
          <li className="py-4 text-sm text-zinc-500">No upcoming blocks.</li>
        ) : (
          slots.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <div className="font-semibold text-white">{s.label}</div>
                <div className="text-xs text-zinc-500">{s.reason ?? 'No reason given'}</div>
              </div>
              <button
                onClick={() => remove(s.id)}
                disabled={pending}
                aria-label="Delete block"
                className="rounded-lg border border-white/10 p-2 text-zinc-500 transition-colors hover:border-emergency/50 hover:text-emergency disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
