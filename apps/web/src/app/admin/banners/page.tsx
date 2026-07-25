import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { BannerForm, BannerList, type BannerRow } from '@/components/admin/BannerManager';
import { fmtDateTime } from '@/components/admin/format';

export const metadata: Metadata = { title: 'Banners' };
export const dynamic = 'force-dynamic';

export default async function AdminBannersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const editId = typeof sp.edit === 'string' ? sp.edit : null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('site_banners')
    .select('id, headline, body, cta_text, cta_url, theme, starts_at, ends_at, is_active')
    .order('created_at', { ascending: false });

  const banners: BannerRow[] = ((data ?? []) as Omit<BannerRow, 'windowLabel'>[]).map((b) => ({
    ...b,
    windowLabel:
      !b.starts_at && !b.ends_at
        ? 'always on (while active)'
        : `${b.starts_at ? fmtDateTime(b.starts_at) : 'now'} → ${b.ends_at ? fmtDateTime(b.ends_at) : 'no end'}`,
  }));

  const editing = editId ? (banners.find((b) => b.id === editId) ?? null) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
          Site banners
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Announcement strips shown on the marketing site while active and within their window.
        </p>
      </div>

      <BannerForm key={editing?.id ?? 'new'} editing={editing} />
      <BannerList banners={banners} />
    </div>
  );
}
