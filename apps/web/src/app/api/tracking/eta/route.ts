import { NextResponse, type NextRequest } from 'next/server';
import { EtaResponseSchema, type EtaResponse } from '@pikavolt/core';
import { createApiClient } from '@/lib/supabase/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tracking/eta?appointmentId=<uuid>
 *
 * Live ETA while the owner is en route. Response contract: EtaResponse
 * (FROZEN — @pikavolt/core). Callers: web appointment page (cookie session)
 * and the Flutter app (Authorization: Bearer <supabase jwt>).
 *
 * - 400 bad/missing appointmentId
 * - 401 no user, or the user is not a participant of that appointment
 * - 404 no active tracking session (none created, or already ended)
 * - 503 coordinates missing so no estimate is possible
 *
 * With GOOGLE_MAPS_SERVER_KEY: Google Routes API computeRoutes (TRAFFIC_AWARE).
 * Without: haversine distance at a 35 mph average — same response shape, so
 * everything degrades gracefully on a keyless dev stack. Either estimate is
 * cached into tracking_sessions.eta_seconds/eta_updated_at and reused for 30s.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE_TTL_MS = 30_000;
/** 35 mph in meters/second — keyless fallback average speed. */
const FALLBACK_SPEED_MPS = 35 * 0.44704;

interface LatLng {
  lat: number;
  lng: number;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Google Routes API computeRoutes, traffic-aware. Null on any failure. */
async function computeRoutesEta(
  key: string,
  origin: LatLng,
  destination: LatLng,
): Promise<{ etaSeconds: number; distanceMeters: number } | null> {
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: {
          location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
      // ETA is time-sensitive; never serve a framework-cached route.
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      routes?: Array<{ duration?: string; distanceMeters?: number }>;
    };
    const route = body.routes?.[0];
    if (!route || typeof route.distanceMeters !== 'number') return null;
    const seconds = Number.parseInt((route.duration ?? '').replace(/s$/i, ''), 10);
    if (!Number.isFinite(seconds)) return null;
    return {
      etaSeconds: Math.max(0, Math.round(seconds)),
      distanceMeters: Math.max(0, Math.round(route.distanceMeters)),
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const appointmentId = request.nextUrl.searchParams.get('appointmentId');
  if (!appointmentId || !UUID_RE.test(appointmentId)) {
    return NextResponse.json({ error: 'appointmentId (uuid) is required' }, { status: 400 });
  }

  // Dual cookie/Bearer auth so the Flutter app can call this too.
  const supabase = await createApiClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // RLS scopes this read to the appointment's customer or the owner; a
  // stranger sees no row. Don't leak existence — treat both as unauthorized.
  const { data: appt } = await supabase
    .from('appointments')
    .select('id, addresses:address_id ( lat, lng )')
    .eq('id', appointmentId)
    .maybeSingle();
  if (!appt) {
    return NextResponse.json({ error: 'Not authorized for this appointment' }, { status: 401 });
  }

  const { data: session } = await supabase
    .from('tracking_sessions')
    .select('id, ended_at, last_lat, last_lng, eta_seconds, eta_updated_at')
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (!session || session.ended_at != null) {
    return NextResponse.json({ error: 'No active tracking session' }, { status: 404 });
  }

  const addr = appt.addresses as unknown as { lat: number | null; lng: number | null } | null;
  const destination: LatLng | null =
    addr && addr.lat != null && addr.lng != null ? { lat: addr.lat, lng: addr.lng } : null;
  const origin: LatLng | null =
    session.last_lat != null && session.last_lng != null
      ? { lat: session.last_lat, lng: session.last_lng }
      : null;

  if (!origin || !destination) {
    return NextResponse.json({ error: 'ETA unavailable — missing coordinates' }, { status: 503 });
  }

  const straightLineMeters = Math.max(0, Math.round(haversineMeters(origin, destination)));

  // Fresh-enough cache → reuse (distance is recomputed cheaply from the
  // snapshot; only the routed duration is worth caching).
  const cacheAge =
    session.eta_updated_at != null ? Date.now() - new Date(session.eta_updated_at).getTime() : null;
  if (
    session.eta_seconds != null &&
    cacheAge !== null &&
    cacheAge >= 0 &&
    cacheAge < CACHE_TTL_MS
  ) {
    const cached: EtaResponse = EtaResponseSchema.parse({
      etaSeconds: session.eta_seconds,
      distanceMeters: straightLineMeters,
      updatedAt: new Date(session.eta_updated_at as string).toISOString(),
    });
    return NextResponse.json(cached);
  }

  // Compute fresh: Routes API when configured, haversine @ 35 mph otherwise.
  const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  let etaSeconds: number;
  let distanceMeters: number;
  const routed = serverKey ? await computeRoutesEta(serverKey, origin, destination) : null;
  if (routed) {
    etaSeconds = routed.etaSeconds;
    distanceMeters = routed.distanceMeters;
  } else {
    distanceMeters = straightLineMeters;
    etaSeconds = Math.max(0, Math.round(straightLineMeters / FALLBACK_SPEED_MPS));
  }

  const updatedAt = new Date().toISOString();

  // Cache write needs service role — RLS only lets the owner update sessions.
  try {
    const admin = createAdminClient();
    await admin
      .from('tracking_sessions')
      .update({ eta_seconds: etaSeconds, eta_updated_at: updatedAt })
      .eq('id', session.id);
  } catch {
    // Cache write is best-effort; the response is still valid without it.
  }

  const payload: EtaResponse = EtaResponseSchema.parse({ etaSeconds, distanceMeters, updatedAt });
  return NextResponse.json(payload);
}
