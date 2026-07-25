/**
 * Pure booking-slot computation — FROZEN CONTRACT.
 *
 * Given business hours, blocked ranges, and existing appointments, computes
 * the bookable slots for one calendar date in the business timezone.
 * All returned timestamps are ISO 8601 UTC strings.
 */
import { addMinutes, isBefore } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

export const DEFAULT_TIMEZONE = 'America/New_York';
export const DEFAULT_SLOT_DURATION_MINUTES = 120;
export const DEFAULT_BUFFER_MINUTES = 30;

export interface BusinessHours {
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  /** 'HH:MM' local (business timezone). */
  opensAt: string;
  /** 'HH:MM' local (business timezone). */
  closesAt: string;
  isOpen: boolean;
}

/** A half-open [startsAt, endsAt) range of ISO 8601 timestamps. */
export interface TimeRange {
  startsAt: string;
  endsAt: string;
}

export interface Slot {
  /** ISO 8601 UTC. */
  startsAt: string;
  /** ISO 8601 UTC. */
  endsAt: string;
  available: boolean;
}

export interface ComputeSlotsInput {
  /** Calendar date 'YYYY-MM-DD' in the business timezone. */
  date: string;
  businessHours: BusinessHours[];
  /** Owner-blocked ranges (vacation, lunch, …). */
  blockedRanges?: TimeRange[];
  /** Existing appointment ranges. */
  appointmentRanges?: TimeRange[];
  /** @default 120 */
  slotDurationMinutes?: number;
  /** Buffer kept free around existing appointments. @default 30 */
  bufferMinutes?: number;
  /** @default 'America/New_York' */
  timezone?: string;
  /** Current time, injectable for tests. @default new Date() */
  now?: Date;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Compute the slots for `date`. Slots step from opening time in increments
 * of `slotDurationMinutes + bufferMinutes` and must end by closing time.
 * Slots that would start in the past (relative to `now`) are omitted.
 *
 * A slot is `available: false` when it overlaps a blocked range, or when it
 * comes within `bufferMinutes` of an existing appointment.
 */
export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const {
    date,
    businessHours,
    blockedRanges = [],
    appointmentRanges = [],
    slotDurationMinutes = DEFAULT_SLOT_DURATION_MINUTES,
    bufferMinutes = DEFAULT_BUFFER_MINUTES,
    timezone = DEFAULT_TIMEZONE,
    now = new Date(),
  } = input;

  if (!DATE_RE.test(date)) {
    throw new RangeError(`date must be 'YYYY-MM-DD'; got '${date}'`);
  }
  if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes <= 0) {
    throw new RangeError(`slotDurationMinutes must be a positive integer; got ${slotDurationMinutes}`);
  }
  if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0) {
    throw new RangeError(`bufferMinutes must be a non-negative integer; got ${bufferMinutes}`);
  }

  // Day of week of the calendar date (timezone-independent for a Y-M-D).
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const hours = businessHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!hours || !hours.isOpen) return [];
  if (!TIME_RE.test(hours.opensAt) || !TIME_RE.test(hours.closesAt)) {
    throw new RangeError(
      `business hours must be 'HH:MM'; got opensAt='${hours.opensAt}' closesAt='${hours.closesAt}'`,
    );
  }

  // Local wall-clock open/close converted to UTC instants (DST-aware).
  const opens = fromZonedTime(`${date}T${hours.opensAt}:00`, timezone);
  const closes = fromZonedTime(`${date}T${hours.closesAt}:00`, timezone);
  if (!isBefore(opens, closes)) return [];

  const blocked = blockedRanges.map((r) => ({
    start: new Date(r.startsAt),
    end: new Date(r.endsAt),
  }));
  const appointments = appointmentRanges.map((r) => ({
    start: new Date(r.startsAt),
    end: new Date(r.endsAt),
  }));

  const slots: Slot[] = [];
  for (
    let start = opens;
    !isBefore(closes, addMinutes(start, slotDurationMinutes));
    start = addMinutes(start, slotDurationMinutes + bufferMinutes)
  ) {
    // Slots must not start in the past.
    if (isBefore(start, now)) continue;

    const end = addMinutes(start, slotDurationMinutes);
    const isBlocked = blocked.some((r) => rangesOverlap(start, end, r.start, r.end));
    // Existing appointments also claim a buffer on both sides.
    const conflicts = appointments.some((r) =>
      rangesOverlap(start, end, addMinutes(r.start, -bufferMinutes), addMinutes(r.end, bufferMinutes)),
    );

    slots.push({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      available: !isBlocked && !conflicts,
    });
  }

  return slots;
}
