'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface DayHours {
  dayOfWeek: number;
  isOpen: boolean;
  /** 'HH:MM' */
  opensAt: string;
  /** 'HH:MM' */
  closesAt: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveBusinessHours(days: DayHours[]): Promise<ActionResult> {
  if (days.length !== 7) return { ok: false, error: 'Expected all 7 days.' };
  for (const d of days) {
    if (d.isOpen && (!TIME_RE.test(d.opensAt) || !TIME_RE.test(d.closesAt))) {
      return { ok: false, error: 'Open days need valid opening and closing times.' };
    }
    if (d.isOpen && d.opensAt >= d.closesAt) {
      return { ok: false, error: 'Closing time must be after opening time.' };
    }
  }

  const supabase = await createClient();
  for (const d of days) {
    const { error } = await supabase
      .from('business_hours')
      .update({
        is_open: d.isOpen,
        opens_at: d.isOpen ? d.opensAt : null,
        closes_at: d.isOpen ? d.closesAt : null,
      })
      .eq('day_of_week', d.dayOfWeek);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/admin/availability');
  return { ok: true };
}

export async function addBlockedSlot(
  startsAt: string,
  endsAt: string,
  reason: string,
): Promise<ActionResult> {
  if (
    !startsAt ||
    !endsAt ||
    Number.isNaN(Date.parse(startsAt)) ||
    Number.isNaN(Date.parse(endsAt))
  ) {
    return { ok: false, error: 'Pick valid start and end times.' };
  }
  if (new Date(startsAt) >= new Date(endsAt)) {
    return { ok: false, error: 'End must be after start.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('blocked_slots').insert({
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    reason: reason.trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/availability');
  revalidatePath('/admin/calendar');
  return { ok: true };
}

export async function deleteBlockedSlot(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('blocked_slots').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/availability');
  revalidatePath('/admin/calendar');
  return { ok: true };
}
