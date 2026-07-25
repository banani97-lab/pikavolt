'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { AppointmentStatus } from '@pikavolt/core';
import { createClient } from '@/lib/supabase/client';
import { EtaCard } from './EtaCard';
import { LiveMap } from './LiveMap';
import { parseTrackingPing, type LatLng, type TrackingPing } from './geo';

interface TrackingSectionProps {
  appointmentId: string;
}

const TRAIL_LIMIT = 40;

interface ApptInfo {
  status: AppointmentStatus;
  destination: LatLng | null;
}

interface SnapshotInfo {
  ended: boolean;
  seed: TrackingPing | null;
}

/**
 * Live technician tracking.
 *
 * - `confirmed`: a calm "you'll see Fares here" card (mascot) — but we still
 *   subscribe, so the section flips live the instant the first ping lands.
 * - `en_route` / `in_progress`: reads the tracking_sessions snapshot (late
 *   joiners get the last known position immediately), subscribes to the
 *   private Supabase broadcast channel `tracking:{appointmentId}` (event
 *   `ping`), and feeds the map/radar + ETA card from that state.
 */
export function TrackingSection({ appointmentId }: TrackingSectionProps) {
  const supabase = useMemo(() => createClient(), []);

  const [booted, setBooted] = useState(false);
  const [appt, setAppt] = useState<ApptInfo | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotInfo>({ ended: false, seed: null });
  const [latest, setLatest] = useState<TrackingPing | null>(null);
  const [trail, setTrail] = useState<TrackingPing[]>([]);
  const [channelLive, setChannelLive] = useState(false);

  // Boot: auth → appointment (status + destination coords) → session snapshot
  // → private broadcast subscription.
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        // supabase-js only forwards tokens to realtime on SIGNED_IN /
        // TOKEN_REFRESHED; a restored session emits INITIAL_SESSION, so set
        // it explicitly or the private channel subscription is rejected.
        await supabase.realtime.setAuth(session.access_token);
      }

      const [{ data: apptRow }, { data: sessionRow }] = await Promise.all([
        supabase
          .from('appointments')
          .select('status, addresses:address_id ( lat, lng )')
          .eq('id', appointmentId)
          .maybeSingle(),
        supabase
          .from('tracking_sessions')
          .select('ended_at, last_lat, last_lng, last_heading, last_ping_at')
          .eq('appointment_id', appointmentId)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      if (apptRow) {
        const addr = apptRow.addresses as unknown as { lat: number | null; lng: number | null } | null;
        setAppt({
          status: apptRow.status as AppointmentStatus,
          destination:
            addr && addr.lat != null && addr.lng != null ? { lat: addr.lat, lng: addr.lng } : null,
        });
      }

      if (sessionRow) {
        const seed: TrackingPing | null =
          sessionRow.last_lat != null && sessionRow.last_lng != null
            ? {
                lat: sessionRow.last_lat as number,
                lng: sessionRow.last_lng as number,
                heading: (sessionRow.last_heading as number | null) ?? null,
                speed: null,
                ts: (sessionRow.last_ping_at as string | null) ?? new Date().toISOString(),
              }
            : null;
        setSnapshot({ ended: sessionRow.ended_at != null, seed });
        if (seed && sessionRow.ended_at == null) {
          setLatest((prev) => prev ?? seed);
          setTrail((prev) => (prev.length ? prev : [seed]));
        }
      }

      setBooted(true);
    };

    void boot();

    const channel = supabase
      .channel(`tracking:${appointmentId}`, { config: { private: true } })
      .on('broadcast', { event: 'ping' }, ({ payload }) => {
        const ping = parseTrackingPing(payload);
        if (!ping) return;
        setLatest(ping);
        setTrail((prev) => [...prev.slice(-(TRAIL_LIMIT - 1)), ping]);
        setSnapshot((prev) => (prev.ended ? { ...prev, ended: false } : prev));
      })
      .subscribe((status) => {
        setChannelLive(status === 'SUBSCRIBED');
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, appointmentId]);

  if (!booted) {
    return (
      <div
        className="h-24 animate-pulse rounded-xl border border-white/10 bg-surface"
        data-testid="tracking-section"
        data-appointment-id={appointmentId}
      />
    );
  }

  const status = appt?.status ?? 'confirmed';
  const enRouteish = status === 'en_route' || status === 'in_progress';
  // A ping flips confirmed → live immediately (owner tapped "on my way").
  const live = (enRouteish || latest !== null) && !snapshot.ended;
  const arrived = snapshot.ended && enRouteish;

  return (
    <section className="space-y-3" data-testid="tracking-section" data-appointment-id={appointmentId}>
      {live ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg uppercase tracking-wide text-white">
              {status === 'in_progress' ? 'Fares is here' : 'Fares is on the way'}
            </h2>
          </div>
          <LiveMap
            latest={latest}
            trail={trail}
            destination={appt?.destination ?? null}
            channelLive={channelLive}
          />
          <EtaCard appointmentId={appointmentId} />
        </>
      ) : arrived ? (
        <div
          className="flex items-center gap-4 rounded-xl border border-white/10 bg-surface p-5"
          data-testid="tracking-arrived"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-volt/15">
            <CheckCircle2 className="h-5 w-5 text-volt" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Fares has arrived</p>
            <p className="text-sm text-muted">Live tracking ended when he reached your address.</p>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-4 rounded-xl border border-white/10 bg-surface p-5"
          data-testid="tracking-waiting"
        >
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <span className="absolute inset-0 animate-pulse-ring rounded-full border border-volt/40" />
            <Image
              src="/mascot-face.png"
              alt=""
              width={44}
              height={44}
              className="rounded-full border border-white/10"
            />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Live tracking</p>
            <p className="text-sm text-muted">
              You’ll see Fares’s live location here when he’s on the way.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
