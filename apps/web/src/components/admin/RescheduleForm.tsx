'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Loader2 } from 'lucide-react';
import type { Slot } from '@pikavolt/core';
import {
  getSlotsForDate,
  rescheduleAppointment,
} from '@/app/admin/appointments/actions';
import { cn } from '@/lib/utils';

function slotLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

export function RescheduleForm({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const loadSlots = async (d: string) => {
    setDate(d);
    setSelected(null);
    setSlots(null);
    setMessage(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    setLoadingSlots(true);
    try {
      const res = await getSlotsForDate(d, appointmentId);
      if (res.error) setMessage({ kind: 'error', text: res.error });
      setSlots(res.slots);
    } finally {
      setLoadingSlots(false);
    }
  };

  const submit = () => {
    if (!selected) return;
    setMessage(null);
    startTransition(async () => {
      const result = await rescheduleAppointment(appointmentId, selected.startsAt, selected.endsAt);
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.error ?? 'Reschedule failed.' });
        return;
      }
      setMessage({ kind: 'info', text: 'Appointment rescheduled.' });
      setOpen(false);
      setDate('');
      setSlots(null);
      setSelected(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-volt/60 hover:text-volt"
      >
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        {open ? 'Close reschedule' : 'Reschedule'}
      </button>

      {open && (
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <label htmlFor="resched-date" className="mb-1.5 block text-sm font-medium text-zinc-300">
            New date
          </label>
          <input
            id="resched-date"
            type="date"
            value={date}
            onChange={(e) => loadSlots(e.target.value)}
            className="h-10 rounded-lg border border-white/15 bg-storm px-3 text-sm text-white [color-scheme:dark]"
          />

          {loadingSlots && (
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
            </div>
          )}

          {slots !== null && !loadingSlots && (
            <div className="mt-3">
              {slots.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No slots that day (closed, fully booked, or in the past).
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.startsAt}
                      disabled={!s.available}
                      onClick={() => setSelected(s)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        !s.available && 'cursor-not-allowed border-white/5 text-zinc-700 line-through',
                        s.available &&
                          (selected?.startsAt === s.startsAt
                            ? 'border-volt bg-volt/15 text-volt'
                            : 'border-white/15 text-zinc-300 hover:border-volt/50 hover:text-white'),
                      )}
                    >
                      {slotLabel(s.startsAt)} – {slotLabel(s.endsAt)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={submit}
              disabled={pending || !selected}
              className="inline-flex items-center gap-2 rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-storm hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm new time
            </button>
          </div>
        </div>
      )}

      {message && (
        <div
          role="status"
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            message.kind === 'error'
              ? 'border-emergency/40 bg-emergency/10 text-emergency'
              : 'border-volt/40 bg-volt/10 text-volt',
          )}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
