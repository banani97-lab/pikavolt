'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { BUSINESS_TZ, formatSlotRange } from './format';
import type { SlotChoice } from './types';

interface SlotDto {
  startsAt: string;
  endsAt: string;
  available: boolean;
}

interface StepSlotProps {
  horizonDays: number;
  selectedSlot: SlotChoice | null;
  onSelect: (slot: SlotChoice) => void;
  /** Set when a deposit attempt bounced off a just-taken slot. */
  conflictNotice?: string | null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function StepSlot({ horizonDays, selectedSlot, onSelect, conflictNotice }: StepSlotProps) {
  // "Today" and the horizon, both as business-timezone calendar dates.
  const todayStr = useMemo(() => formatInTimeZone(new Date(), BUSINESS_TZ, 'yyyy-MM-dd'), []);
  const maxStr = useMemo(
    () =>
      formatInTimeZone(
        new Date(Date.now() + horizonDays * 86_400_000),
        BUSINESS_TZ,
        'yyyy-MM-dd',
      ),
    [horizonDays],
  );

  const [viewYear, setViewYear] = useState(() => Number(todayStr.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(todayStr.slice(5, 7)) - 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    selectedSlot ? formatInTimeZone(new Date(selectedSlot.startsAt), BUSINESS_TZ, 'yyyy-MM-dd') : null,
  );
  const [slots, setSlots] = useState<SlotDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSlots = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    setSlots(null);
    try {
      const res = await fetch(`/api/slots?date=${date}`);
      if (!res.ok) throw new Error('Could not load availability');
      const body = (await res.json()) as { slots: SlotDto[] };
      setSlots(body.slots);
    } catch {
      setError('Could not load availability — try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) void loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  // Month grid (leading blanks + day numbers). Pure Y-M-D math — no TZ drift.
  const grid = useMemo(() => {
    const firstDow = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const cells: Array<{ day: number; date: string } | null> = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: ymd(viewYear, viewMonth, d) });
    return cells;
  }, [viewYear, viewMonth]);

  const monthStart = ymd(viewYear, viewMonth, 1);
  const canGoPrev = monthStart > todayStr.slice(0, 8) + '01';
  const canGoNext = ymd(viewYear, viewMonth + 1, 1) <= maxStr;

  const changeMonth = (delta: number) => {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  };

  return (
    <div className="space-y-5">
      {conflictNotice && (
        <div className="rounded-lg border border-emergency/40 bg-emergency/10 px-4 py-3 text-sm text-emergency">
          {conflictNotice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Calendar */}
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              disabled={!canGoPrev}
              aria-label="Previous month"
              className="rounded-lg border border-white/10 p-1.5 text-zinc-400 transition-colors hover:border-volt/50 hover:text-volt disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-zinc-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-white">
              {MONTHS[viewMonth]} {viewYear}
            </p>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              disabled={!canGoNext}
              aria-label="Next month"
              className="rounded-lg border border-white/10 p-1.5 text-zinc-400 transition-colors hover:border-volt/50 hover:text-volt disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-zinc-400"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1 text-[11px] font-medium uppercase text-zinc-500">
                {d}
              </div>
            ))}
            {grid.map((cell, i) =>
              cell ? (
                <button
                  key={cell.date}
                  type="button"
                  disabled={cell.date < todayStr || cell.date > maxStr}
                  onClick={() => setSelectedDate(cell.date)}
                  className={cn(
                    'aspect-square rounded-lg text-sm transition-all',
                    cell.date === selectedDate
                      ? 'bg-volt font-bold text-storm shadow-volt-glow'
                      : cell.date === todayStr
                        ? 'border border-volt/50 text-volt hover:bg-volt/10'
                        : 'text-zinc-300 hover:bg-white/10',
                    (cell.date < todayStr || cell.date > maxStr) &&
                      'cursor-not-allowed text-zinc-700 hover:bg-transparent',
                  )}
                >
                  {cell.day}
                </button>
              ) : (
                <div key={`blank-${i}`} />
              ),
            )}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Booking up to {horizonDays} days out · times shown in Eastern time
          </p>
        </div>

        {/* Slots for the selected day */}
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          {!selectedDate && (
            <p className="py-10 text-center text-sm text-zinc-500">
              Pick a day to see available times.
            </p>
          )}
          {selectedDate && loading && (
            <p className="py-10 text-center text-sm text-zinc-500">Checking availability…</p>
          )}
          {selectedDate && error && (
            <p className="py-10 text-center text-sm text-emergency">{error}</p>
          )}
          {selectedDate && !loading && !error && slots && (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedDate}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {slots.length === 0 && (
                  <p className="py-10 text-center text-sm text-zinc-500">
                    Closed this day — pick another date.
                  </p>
                )}
                {slots.map((slot) => {
                  const isSelected = selectedSlot?.startsAt === slot.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => onSelect({ startsAt: slot.startsAt, endsAt: slot.endsAt })}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm transition-all',
                        isSelected
                          ? 'border-volt bg-volt/15 text-volt shadow-volt-glow'
                          : slot.available
                            ? 'border-white/15 text-white hover:border-volt/60 hover:text-volt'
                            : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600',
                      )}
                    >
                      <span className={cn(!slot.available && 'line-through')}>
                        {formatSlotRange(slot.startsAt, slot.endsAt)}
                      </span>
                      {slot.available ? (
                        isSelected && <Zap className="h-4 w-4 fill-volt text-volt" />
                      ) : (
                        <span className="text-xs uppercase tracking-wide">Booked</span>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
