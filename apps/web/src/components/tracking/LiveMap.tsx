'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Radio, Zap } from 'lucide-react';
import {
  compassLabel,
  formatAgo,
  formatMiles,
  haversineMeters,
  type LatLng,
  type TrackingPing,
} from './geo';

export interface LiveMapProps {
  latest: TrackingPing | null;
  trail: TrackingPing[];
  /** Appointment address coordinates; null hides the destination pin. */
  destination: LatLng | null;
  /** Realtime channel health, for the "live" indicator. */
  channelLive: boolean;
}

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

/**
 * Live technician map. With NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY set this is a
 * dark-themed Google map with a smoothly interpolated volt-bolt van marker;
 * without a key it degrades to a branded radar panel driven by the exact same
 * ping state, so the realtime plumbing is fully exercised either way.
 */
export function LiveMap(props: LiveMapProps) {
  if (!BROWSER_KEY) return <RadarFallback {...props} />;
  return (
    <APIProvider apiKey={BROWSER_KEY}>
      <GoogleLiveMap {...props} />
    </APIProvider>
  );
}

// ---------------------------------------------------------------------------
// Google Maps path (browser key present)
// ---------------------------------------------------------------------------

/** Storm/teal night styling to match the brand (docs/brand.md). */
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0e2a33' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9fb8c2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#081a21' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1b4254' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#081a21' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a5e73' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9fb8c2' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#081a21' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0c222b' }] },
];

/** Volt bolt-in-a-van-badge marker SVG, rotated to the current heading. */
function boltMarkerSvg(heading: number | null): string {
  const rotate = heading === null ? '' : ` transform="rotate(${Math.round(heading)} 24 24)"`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
    `<g${rotate}>` +
    (heading === null
      ? ''
      : `<path d="M24 2 L30 12 L18 12 Z" fill="#22D3EE" opacity="0.9"/>`) +
    `<circle cx="24" cy="24" r="13" fill="#081A21" stroke="#FFE600" stroke-width="2.5"/>` +
    `<path d="M25.5 16.5 L19 25.5 L23.4 25.5 L22.5 31.5 L29 22.5 L24.6 22.5 Z" fill="#FFE600"/>` +
    `</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const DEST_PIN_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">` +
    `<path d="M18 2 C9.7 2 3 8.7 3 17 C3 28 18 42 18 42 C18 42 33 28 33 17 C33 8.7 26.3 2 18 2 Z" fill="#22D3EE" stroke="#081A21" stroke-width="2"/>` +
    `<circle cx="18" cy="16.5" r="6" fill="#081A21"/>` +
    `</svg>`,
)}`;

const LERP_MS = 2000;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Smoothly interpolated marker position: animates to each new ping over ~2s. */
function useLerpedPosition(latest: TrackingPing | null): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(latest ? { lat: latest.lat, lng: latest.lng } : null);
  const posRef = useRef<LatLng | null>(pos);
  posRef.current = pos;

  useEffect(() => {
    if (!latest) return;
    const from = posRef.current;
    const to = { lat: latest.lat, lng: latest.lng };
    if (!from) {
      setPos(to);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const step = (t: number) => {
      const k = easeInOut(Math.min(1, (t - startedAt) / LERP_MS));
      setPos({ lat: from.lat + (to.lat - from.lat) * k, lng: from.lng + (to.lng - from.lng) * k });
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [latest]);

  return pos;
}

function GoogleLiveMap({ latest, trail, destination, channelLive }: LiveMapProps) {
  const map = useMap();
  const markerPos = useLerpedPosition(latest);
  const techIcon = useMemo(() => boltMarkerSvg(latest?.heading ?? null), [latest?.heading]);

  // Auto-fit bounds around the technician + destination whenever either moves
  // out of frame (and on first fix).
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!map || !latest) return;
    const points: LatLng[] = [{ lat: latest.lat, lng: latest.lng }];
    if (destination) points.push(destination);
    const bounds = {
      north: Math.max(...points.map((p) => p.lat)),
      south: Math.min(...points.map((p) => p.lat)),
      east: Math.max(...points.map((p) => p.lng)),
      west: Math.min(...points.map((p) => p.lng)),
    };
    if (!fittedRef.current) {
      map.fitBounds(bounds, 64);
      fittedRef.current = true;
      return;
    }
    const current = map.getBounds();
    if (current && !current.contains({ lat: latest.lat, lng: latest.lng })) {
      map.fitBounds(bounds, 64);
    }
  }, [map, latest, destination]);

  // Trail polyline drawn imperatively (no vis.gl Polyline component).
  const polylineRef = useRef<{ setPath: (p: LatLng[]) => void; setMap: (m: unknown) => void } | null>(
    null,
  );
  useEffect(() => {
    if (!map) return;
    const g = (globalThis as { google?: { maps?: { Polyline?: new (opts: object) => never } } })
      .google;
    if (!g?.maps?.Polyline) return;
    if (!polylineRef.current) {
      polylineRef.current = new g.maps.Polyline({
        map,
        path: [],
        strokeColor: '#FFE600',
        strokeOpacity: 0.7,
        strokeWeight: 3,
      }) as unknown as { setPath: (p: LatLng[]) => void; setMap: (m: unknown) => void };
    }
    polylineRef.current.setPath(trail.map((p) => ({ lat: p.lat, lng: p.lng })));
  }, [map, trail]);
  useEffect(
    () => () => {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    },
    [],
  );

  const center = markerPos ?? destination ?? { lat: 40.0992, lng: -83.1141 };

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10" data-testid="tracking-map">
      <Map
        defaultCenter={center}
        defaultZoom={13}
        styles={DARK_MAP_STYLES}
        disableDefaultUI
        gestureHandling="greedy"
        backgroundColor="#081a21"
        className="h-72 w-full sm:h-80"
      >
        {markerPos && (
          <Marker
            position={markerPos}
            icon={techIcon}
            title="Fares"
            zIndex={2}
          />
        )}
        {destination && (
          <Marker position={destination} icon={DEST_PIN_SVG} title="Your address" zIndex={1} />
        )}
      </Map>
      <LiveBadge live={channelLive} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branded radar fallback (no browser key) — same ping state, zero Google.
// ---------------------------------------------------------------------------

function RadarFallback({ latest, trail, destination, channelLive }: LiveMapProps) {
  // Local 1s tick so "updated Xs ago" stays honest between pings.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const distanceMeters =
    latest && destination ? haversineMeters(latest, destination) : null;
  const speedMph = latest?.speed != null ? Math.round(latest.speed * 2.23694) : null;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/10 bg-storm-gradient"
      data-testid="tracking-radar"
    >
      <div className="flex flex-col items-center gap-5 px-5 py-8 sm:flex-row sm:gap-8 sm:px-8">
        {/* Radar dial */}
        <div className="relative h-40 w-40 shrink-0">
          {/* pulsing rings */}
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute inset-0 rounded-full border border-arc/40"
              style={{
                animation: 'radar-ring 3s ease-out infinite',
                animationDelay: `${i}s`,
              }}
            />
          ))}
          {/* static grid rings */}
          <span className="absolute inset-4 rounded-full border border-white/10" />
          <span className="absolute inset-10 rounded-full border border-white/10" />
          {/* rotating sweep */}
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, rgb(34 211 238 / 0.35), transparent 70deg)',
              animation: 'radar-sweep 4s linear infinite',
            }}
          />
          {/* center bolt */}
          <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-volt bg-storm shadow-volt-glow">
            <Zap className="h-6 w-6 text-volt" fill="currentColor" />
          </span>
          <style>{`
            @keyframes radar-ring {
              0% { transform: scale(0.35); opacity: 0.9; }
              100% { transform: scale(1); opacity: 0; }
            }
            @keyframes radar-sweep {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>

        {/* Live readout */}
        <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
          {latest ? (
            <>
              <p className="text-lg font-semibold text-white">
                {distanceMeters !== null
                  ? `Fares is ${formatMiles(distanceMeters)} away`
                  : 'Fares is on the move'}
                <span className="text-muted"> · updated {formatAgo(latest.ts, now)}</span>
              </p>
              <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted sm:justify-start">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                  <MapPin className="h-3.5 w-3.5 text-arc" />
                  {latest.lat.toFixed(5)}, {latest.lng.toFixed(5)}
                </span>
                {latest.heading !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Navigation
                      className="h-3.5 w-3.5 text-volt"
                      style={{ transform: `rotate(${latest.heading - 45}deg)` }}
                    />
                    heading {compassLabel(latest.heading)}
                  </span>
                )}
                {speedMph !== null && <span>{speedMph} mph</span>}
              </p>
              <p className="text-xs text-muted/80">
                {trail.length > 1
                  ? `${trail.length} location pings received`
                  : 'First location ping received'}
                {' — map view appears when Google Maps is configured.'}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-white">Locking onto Fares’s van…</p>
              <p className="text-sm text-muted">
                Waiting for the first location ping. This updates live the moment he starts
                driving.
              </p>
            </>
          )}
        </div>
      </div>
      <LiveBadge live={channelLive} />
    </div>
  );
}

function LiveBadge({ live }: { live: boolean }) {
  return (
    <span
      className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-storm/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide backdrop-blur"
      data-testid="tracking-live-badge"
    >
      <Radio className={`h-3 w-3 ${live ? 'text-arc' : 'text-muted'}`} />
      <span className={live ? 'text-arc' : 'text-muted'}>{live ? 'Live' : 'Connecting'}</span>
      {live && <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-arc" />}
    </span>
  );
}
