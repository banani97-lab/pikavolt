import { createClient } from '@supabase/supabase-js';
import {
  SERVICE_CATEGORIES,
  type ServiceCategory as StaticCategory,
} from '@/lib/serviceCategories';

/**
 * Public (anon) data access for marketing pages.
 *
 * Uses a plain supabase-js client — no cookies — so server components stay
 * statically renderable / ISR-friendly. All reads here are covered by public
 * RLS policies. Every fetcher fails soft (static fallback or empty result) so
 * the marketing site never hard-crashes if the database is unreachable.
 */

export interface DbServiceCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface DbService {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface SiteBanner {
  id: string;
  headline: string;
  body: string | null;
  cta_text: string | null;
  cta_url: string | null;
  theme: 'volt' | 'storm' | 'emergency';
}

export interface Sweepstake {
  id: string;
  title: string;
  description: string | null;
  prize: string | null;
  rules_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** All 7 active categories, ordered. Falls back to the static list. */
export async function getServiceCategories(): Promise<DbServiceCategory[]> {
  try {
    const supabase = publicClient();
    if (!supabase) throw new Error('supabase env missing');
    const { data, error } = await supabase
      .from('service_categories')
      .select('id, slug, name, description, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    if (data && data.length > 0) return data;
    throw new Error('no categories');
  } catch {
    return SERVICE_CATEGORIES.map(staticCategoryToDb);
  }
}

/** One category + its full line-item list. Falls back to the static list. */
export async function getCategoryWithServices(
  slug: string,
): Promise<{ category: DbServiceCategory; services: DbService[] } | null> {
  try {
    const supabase = publicClient();
    if (!supabase) throw new Error('supabase env missing');
    const { data: category, error: catError } = await supabase
      .from('service_categories')
      .select('id, slug, name, description, sort_order')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (catError) throw catError;
    if (!category) return staticCategoryFallback(slug);

    const { data: services, error: svcError } = await supabase
      .from('services')
      .select('id, name, description, sort_order')
      .eq('category_id', category.id)
      .eq('is_active', true)
      .order('sort_order');
    if (svcError) throw svcError;
    if (!services || services.length === 0) return staticCategoryFallback(slug);
    return { category, services };
  } catch {
    return staticCategoryFallback(slug);
  }
}

/** Active banners inside their scheduling window (RLS also enforces this). */
export async function getActiveBanners(): Promise<SiteBanner[]> {
  try {
    const supabase = publicClient();
    if (!supabase) return [];
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('site_banners')
      .select('id, headline, body, cta_text, cta_url, theme')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as SiteBanner[];
  } catch {
    return [];
  }
}

/** The current active sweepstakes within its window, or null. */
export async function getActiveSweepstakes(): Promise<Sweepstake | null> {
  try {
    const supabase = publicClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('sweepstakes')
      .select('id, title, description, prize, rules_url, starts_at, ends_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error || !data) return null;
    const now = Date.now();
    return (
      data.find((s) => {
        const started = !s.starts_at || Date.parse(s.starts_at) <= now;
        const notEnded = !s.ends_at || Date.parse(s.ends_at) >= now;
        return started && notEnded;
      }) ?? null
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------

function staticCategoryToDb(c: StaticCategory): DbServiceCategory {
  return {
    id: `static-${c.slug}`,
    slug: c.slug,
    name: c.name,
    description: c.blurb,
    sort_order: SERVICE_CATEGORIES.indexOf(c) + 1,
  };
}

function staticCategoryFallback(
  slug: string,
): { category: DbServiceCategory; services: DbService[] } | null {
  const match = SERVICE_CATEGORIES.find((c) => c.slug === slug);
  if (!match) return null;
  return {
    category: staticCategoryToDb(match),
    services: match.items.map((name, i) => ({
      id: `static-${slug}-${i}`,
      name,
      description: null,
      sort_order: i + 1,
    })),
  };
}
