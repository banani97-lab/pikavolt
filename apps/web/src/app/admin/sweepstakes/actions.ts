'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface SweepstakesInput {
  title: string;
  description: string;
  prize: string;
  rulesUrl: string;
  /** date inputs (yyyy-mm-dd) or '' */
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

function normalize(input: SweepstakesInput):
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Title is required.' };

  const startsAt = input.startsAt ? new Date(`${input.startsAt}T00:00:00`) : null;
  const endsAt = input.endsAt ? new Date(`${input.endsAt}T23:59:59`) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    return { ok: false, error: 'Invalid dates.' };
  }
  if (startsAt && endsAt && startsAt >= endsAt) {
    return { ok: false, error: 'End date must be after start date.' };
  }

  return {
    ok: true,
    row: {
      title,
      description: input.description.trim() || null,
      prize: input.prize.trim() || null,
      rules_url: input.rulesUrl.trim() || null,
      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,
      is_active: input.isActive,
    },
  };
}

export async function createSweepstakes(input: SweepstakesInput): Promise<ActionResult> {
  const parsed = normalize(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sweepstakes')
    .insert(parsed.row)
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/sweepstakes');
  return { ok: true, id: data.id as string };
}

export async function updateSweepstakes(
  id: string,
  input: SweepstakesInput,
): Promise<ActionResult> {
  const parsed = normalize(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from('sweepstakes').update(parsed.row).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/sweepstakes');
  revalidatePath(`/admin/sweepstakes/${id}`);
  return { ok: true, id };
}
