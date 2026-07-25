'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatMiles } from './geo';

const POLL_MS = 45_000;

interface EtaState {
  etaSeconds: number;
  distanceMeters: number;
  updatedAt: string;
  /** Local clock when this poll landed — drives the between-poll countdown. */
  fetchedAt: number;
}

/**
 * ETA card — polls GET /api/tracking/eta every 45s and counts down locally
 * between polls. Degrades to "ETA unavailable" on 503/404/network errors
 * (and keeps polling — the Routes key or the session may come back).
 */
export function EtaCard({ appointmentId }: { appointmentId: string }) {
  const [eta, setEta] = useState<EtaState | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Poll the API.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/tracking/eta?appointmentId=${encodeURIComponent(appointmentId)}`,
          { cache: 'no-store' },
        );
        if (cancelled) return;
        if (!res.ok) {
          setUnavailable(true);
          return;
        }
        const body = (await res.json()) as {
          etaSeconds?: unknown;
          distanceMeters?: unknown;
          updatedAt?: unknown;
        };
        if (cancelled) return;
        if (
          typeof body.etaSeconds === 'number' &&
          typeof body.distanceMeters === 'number' &&
          typeof body.updatedAt === 'string'
        ) {
          setEta({
            etaSeconds: body.etaSeconds,
            distanceMeters: body.distanceMeters,
            updatedAt: body.updatedAt,
            fetchedAt: Date.now(),
          });
          setUnavailable(false);
        } else {
          setUnavailable(true);
        }
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [appointmentId]);

  // 1s ticker for the local countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = eta ? Math.max(0, eta.etaSeconds - Math.round((now - eta.fetchedAt) / 1000)) : null;

  let headline: string;
  let sub: string;
  if (unavailable && !eta) {
    headline = 'ETA unavailable';
    sub = 'We’ll keep checking while Fares is on the move.';
  } else if (remaining === null) {
    headline = 'Calculating ETA…';
    sub = 'Crunching the route.';
  } else if (remaining <= 60) {
    headline = 'Almost there';
    sub = `${formatMiles(eta!.distanceMeters)} out`;
  } else {
    headline = `${Math.ceil(remaining / 60)} min`;
    sub = `${formatMiles(eta!.distanceMeters)} away${unavailable ? ' · last known estimate' : ''}`;
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-storm/60 px-4 py-3"
      data-testid="tracking-eta"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-volt/15">
        <Clock className="h-[18px] w-[18px] text-volt" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-white">{headline}</p>
        <p className="truncate text-xs text-muted">{sub}</p>
      </div>
    </div>
  );
}
