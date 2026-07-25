'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import {
  canTransition,
  computeSlots,
  isAppointmentStatus,
  SERVICE_CALL_FEE_CENTS,
  type AppointmentStatus,
  type Slot,
} from '@pikavolt/core';
import { createClient } from '@/lib/supabase/server';
import { notifyBookingConfirmed, notifyTechEnRoute } from '@/lib/appointments';

import { refundCancelledAppointment } from './refund';
import { businessDayRange } from '@/components/admin/format';

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Non-fatal informational message (e.g. payments module pending). */
  info?: string;
}

/** Postgres error code for exclusion-constraint violations (overlap guard). */
const EXCLUSION_VIOLATION = '23P01';

function revalidate(id: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/appointments');
  revalidatePath(`/admin/appointments/${id}`);
  revalidatePath('/admin/calendar');
}

async function transition(
  id: string,
  to: AppointmentStatus,
  patch: Record<string, unknown> = {},
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: appt, error: readError } = await supabase
    .from('appointments')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!appt) return { ok: false, error: 'Appointment not found.' };

  const from = appt.status as AppointmentStatus;
  if (!isAppointmentStatus(from) || !canTransition(from, to, 'owner')) {
    return { ok: false, error: `Cannot move this appointment from "${from}" to "${to}".` };
  }

  const { error } = await supabase
    .from('appointments')
    .update({ status: to, ...patch })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidate(id);
  return { ok: true };
}

/** requested → confirmed, then notify the customer. */
export async function approveAppointment(id: string): Promise<ActionResult> {
  const result = await transition(id, 'confirmed');
  if (!result.ok) return result;
  await notifyBookingConfirmed(id);
  return result;
}

/** Any owner-cancellable status → cancelled, with a reason. */
export async function cancelAppointment(id: string, reason: string): Promise<ActionResult> {
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: 'A cancellation reason is required.' };

  const result = await transition(id, 'cancelled', { cancelled_reason: trimmed });
  if (!result.ok) return result;

  const refund = await refundCancelledAppointment(id);
  return { ok: true, info: refund.note };
}

/** confirmed → en_route (normally from mobile; allowed here too). */
export async function markEnRoute(id: string): Promise<ActionResult> {
  const result = await transition(id, 'en_route');
  if (result.ok) await notifyTechEnRoute(id);
  return result;
}

/** en_route → in_progress. */
export async function markArrived(id: string): Promise<ActionResult> {
  return transition(id, 'in_progress');
}

/** en_route | in_progress → no_show. */
export async function markNoShow(id: string): Promise<ActionResult> {
  return transition(id, 'no_show');
}

/**
 * in_progress → completed with job total + notes, then kick off the final
 * charge via POST /api/payments/final (WS-B). Tolerates a 501 stub.
 */
export async function completeJob(
  id: string,
  jobTotalDollars: number,
  jobNotes: string,
): Promise<ActionResult> {
  if (!Number.isFinite(jobTotalDollars)) {
    return { ok: false, error: 'Enter a valid job total.' };
  }
  const jobTotalCents = Math.round(jobTotalDollars * 100);
  if (jobTotalCents < SERVICE_CALL_FEE_CENTS) {
    return {
      ok: false,
      error: `Job total must be at least $${SERVICE_CALL_FEE_CENTS / 100} (the service call fee).`,
    };
  }

  const result = await transition(id, 'completed', {
    job_total_cents: jobTotalCents,
    job_notes: jobNotes.trim() || null,
  });
  if (!result.ok) return result;

  // Kick the final payment. WS-B owns this endpoint; it may still be a stub.
  try {
    const h = await headers();
    const host = h.get('host') ?? 'localhost:3003';
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const res = await fetch(`${proto}://${host}/api/payments/final`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: h.get('cookie') ?? '',
      },
      body: JSON.stringify({ appointmentId: id, appointment_id: id }),
      cache: 'no-store',
    });

    if (res.status === 501) {
      return {
        ok: true,
        info: 'Job saved as completed — payments module pending, final charge not initiated.',
      };
    }
    if (!res.ok) {
      return {
        ok: true,
        info: `Job saved as completed, but the final charge failed to start (HTTP ${res.status}). Retry from the payments page.`,
      };
    }
    return { ok: true, info: 'Job completed — final payment initiated.' };
  } catch {
    return {
      ok: true,
      info: 'Job saved as completed, but /api/payments/final was unreachable.',
    };
  }
}

/** Update the scheduled window; guards the DB overlap exclusion constraint. */
export async function rescheduleAppointment(
  id: string,
  startsAt: string,
  endsAt: string,
): Promise<ActionResult> {
  if (!startsAt || !endsAt || Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt))) {
    return { ok: false, error: 'Pick a valid slot first.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('appointments')
    .update({ scheduled_start: startsAt, scheduled_end: endsAt })
    .eq('id', id);

  if (error) {
    if (error.code === EXCLUSION_VIOLATION) {
      return {
        ok: false,
        error: 'That time overlaps another appointment. Pick a different slot.',
      };
    }
    return { ok: false, error: error.message };
  }

  revalidate(id);
  return { ok: true };
}

/**
 * Available slots for a date (business hours minus blocks and other
 * appointments), excluding the appointment being rescheduled.
 * Computed locally with @pikavolt/core because /api/slots may still be a stub.
 */
export async function getSlotsForDate(
  date: string,
  excludeAppointmentId?: string,
): Promise<{ slots: Slot[]; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { slots: [], error: 'Invalid date.' };

  const supabase = await createClient();
  const { startIso, endIso } = businessDayRange(date);

  const [{ data: hours }, { data: blocked }, { data: appts }] = await Promise.all([
    supabase.from('business_hours').select('day_of_week, opens_at, closes_at, is_open'),
    supabase
      .from('blocked_slots')
      .select('starts_at, ends_at')
      .lt('starts_at', endIso)
      .gt('ends_at', startIso),
    supabase
      .from('appointments')
      .select('id, scheduled_start, scheduled_end, status')
      .lt('scheduled_start', endIso)
      .gt('scheduled_end', startIso)
      .not('status', 'in', '(cancelled,no_show)'),
  ]);

  try {
    const slots = computeSlots({
      date,
      businessHours: (hours ?? []).map(
        (h: { day_of_week: number; opens_at: string | null; closes_at: string | null; is_open: boolean }) => ({
          dayOfWeek: h.day_of_week,
          opensAt: (h.opens_at ?? '00:00').slice(0, 5),
          closesAt: (h.closes_at ?? '00:00').slice(0, 5),
          isOpen: h.is_open,
        }),
      ),
      blockedRanges: (blocked ?? []).map((b: { starts_at: string; ends_at: string }) => ({
        startsAt: b.starts_at,
        endsAt: b.ends_at,
      })),
      appointmentRanges: (appts ?? [])
        .filter((a: { id: string }) => a.id !== excludeAppointmentId)
        .map((a: { scheduled_start: string; scheduled_end: string }) => ({
          startsAt: a.scheduled_start,
          endsAt: a.scheduled_end,
        })),
    });
    return { slots };
  } catch (e) {
    return { slots: [], error: e instanceof Error ? e.message : 'Failed to compute slots.' };
  }
}
