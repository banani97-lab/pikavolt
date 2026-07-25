/**
 * Shared client-side geo helpers + the FROZEN broadcast ping contract for
 * live technician tracking (channel `tracking:{appointment_id}`, event `ping`).
 */

/** FROZEN CONTRACT — payload of the `ping` broadcast event. */
export interface TrackingPing {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  /** ISO 8601 timestamp. */
  ts: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Runtime guard for broadcast payloads (never trust the wire). */
export function parseTrackingPing(payload: unknown): TrackingPing | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.lat !== 'number' || !Number.isFinite(p.lat)) return null;
  if (typeof p.lng !== 'number' || !Number.isFinite(p.lng)) return null;
  const heading = typeof p.heading === 'number' && Number.isFinite(p.heading) ? p.heading : null;
  const speed = typeof p.speed === 'number' && Number.isFinite(p.speed) ? p.speed : null;
  const ts = typeof p.ts === 'string' ? p.ts : new Date().toISOString();
  return { lat: p.lat, lng: p.lng, heading, speed, ts };
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in meters. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

/** "0.4 mi" / "3.2 mi" / "12 mi". */
export function formatMiles(meters: number): string {
  const mi = metersToMiles(meters);
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** 0–360° heading → compass label ("NE"). */
export function compassLabel(heading: number): string {
  const idx = Math.round((((heading % 360) + 360) % 360) / 45) % 8;
  return COMPASS[idx] ?? 'N';
}

/** "just now" / "5s ago" / "2m ago". */
export function formatAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 3) return 'just now';
  if (seconds < 90) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}
