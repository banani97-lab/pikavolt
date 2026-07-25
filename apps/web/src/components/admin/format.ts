import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays } from 'date-fns';
import type { AppointmentStatus } from '@pikavolt/core';

/** Business timezone — mirrors @pikavolt/core DEFAULT_TIMEZONE. */
export const BUSINESS_TZ = 'America/New_York';

export function fmtUSD(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatInTimeZone(new Date(iso), BUSINESS_TZ, 'MMM d, yyyy');
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatInTimeZone(new Date(iso), BUSINESS_TZ, 'h:mm a');
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatInTimeZone(new Date(iso), BUSINESS_TZ, 'MMM d, yyyy · h:mm a');
}

/** 'YYYY-MM-DD' in the business timezone for a Date (default now). */
export function businessDay(d: Date = new Date()): string {
  return formatInTimeZone(d, BUSINESS_TZ, 'yyyy-MM-dd');
}

/** UTC ISO range [start, end) covering one business-timezone calendar day. */
export function businessDayRange(day: string): { startIso: string; endIso: string } {
  const start = fromZonedTime(`${day}T00:00:00`, BUSINESS_TZ);
  // Add a day to the instant then re-derive the local day — DST safe.
  const nextDay = formatInTimeZone(addDays(start, 1), BUSINESS_TZ, 'yyyy-MM-dd');
  const end = fromZonedTime(`${nextDay}T00:00:00`, BUSINESS_TZ);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export interface StatusMeta {
  label: string;
  /** Badge classes (border/bg/text). */
  badge: string;
  /** Solid dot / chip accent color class. */
  dot: string;
}

export const STATUS_META: Record<AppointmentStatus, StatusMeta> = {
  requested: {
    label: 'Requested',
    badge: 'border-volt/40 bg-volt/10 text-volt',
    dot: 'bg-volt',
  },
  confirmed: {
    label: 'Confirmed',
    badge: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
    dot: 'bg-sky-400',
  },
  en_route: {
    label: 'En route',
    badge: 'border-arc-end/40 bg-arc-end/10 text-arc-end',
    dot: 'bg-arc-end',
  },
  in_progress: {
    label: 'In progress',
    badge: 'border-orange-400/40 bg-orange-400/10 text-orange-300',
    dot: 'bg-orange-400',
  },
  completed: {
    label: 'Completed',
    badge: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  closed: {
    label: 'Closed',
    badge: 'border-white/20 bg-white/5 text-zinc-300',
    dot: 'bg-zinc-400',
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'border-emergency/40 bg-emergency/10 text-emergency',
    dot: 'bg-emergency',
  },
  no_show: {
    label: 'No-show',
    badge: 'border-rose-400/40 bg-rose-400/10 text-rose-300',
    dot: 'bg-rose-400',
  },
};

export interface AddressLike {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
}

export function addressText(a: AddressLike): string {
  return [a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join(', ');
}

export function mapsUrl(a: AddressLike): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText(a))}`;
}

export function stripePaymentUrl(paymentIntentId: string): string {
  return `https://dashboard.stripe.com/test/payments/${paymentIntentId}`;
}
