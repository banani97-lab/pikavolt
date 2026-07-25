import { formatInTimeZone } from 'date-fns-tz';

/** Business timezone — all slots display in Eastern time. */
export const BUSINESS_TZ = 'America/New_York';

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** '8:00 AM' in business time. */
export function formatSlotTime(iso: string): string {
  return formatInTimeZone(new Date(iso), BUSINESS_TZ, 'h:mm a');
}

/** '8:00 AM – 10:00 AM' in business time. */
export function formatSlotRange(startIso: string, endIso: string): string {
  return `${formatSlotTime(startIso)} – ${formatSlotTime(endIso)}`;
}

/** 'Tuesday, July 14' in business time. */
export function formatDayLong(iso: string): string {
  return formatInTimeZone(new Date(iso), BUSINESS_TZ, 'EEEE, MMMM d');
}

/** 'Tue, Jul 14, 2026 · 8:00 AM EDT' in business time. */
export function formatApptStart(iso: string): string {
  return formatInTimeZone(new Date(iso), BUSINESS_TZ, "EEE, MMM d, yyyy '·' h:mm a zzz");
}
