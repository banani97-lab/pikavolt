'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface BannerInput {
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  theme: 'volt' | 'storm' | 'emergency';
  /** datetime-local values (or '') */
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const THEMES = ['volt', 'storm', 'emergency'] as const;

function normalize(input: BannerInput):
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string } {
  const headline = input.headline.trim();
  if (!headline) return { ok: false, error: 'Headline is required.' };
  if (!THEMES.includes(input.theme)) return { ok: false, error: 'Invalid theme.' };

  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    return { ok: false, error: 'Invalid window dates.' };
  }
  if (startsAt && endsAt && startsAt >= endsAt) {
    return { ok: false, error: 'Window end must be after its start.' };
  }

  return {
    ok: true,
    row: {
      headline,
      body: input.body.trim() || null,
      cta_text: input.ctaText.trim() || null,
      cta_url: input.ctaUrl.trim() || null,
      theme: input.theme,
      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,
      is_active: input.isActive,
    },
  };
}

function revalidate() {
  revalidatePath('/admin/banners');
  revalidatePath('/'); // marketing strip reads active banners
}

export async function createBanner(input: BannerInput): Promise<ActionResult> {
  const parsed = normalize(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from('site_banners').insert(parsed.row);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateBanner(id: string, input: BannerInput): Promise<ActionResult> {
  const parsed = normalize(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from('site_banners').update(parsed.row).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function toggleBanner(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('site_banners')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteBanner(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('site_banners').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
