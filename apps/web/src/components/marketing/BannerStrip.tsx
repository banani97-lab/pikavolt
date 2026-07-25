import Link from 'next/link';
import { Zap, ArrowRight } from 'lucide-react';
import { getActiveBanners, type SiteBanner } from '@/lib/marketingData';
import { cn } from '@/lib/utils';

const themeStyles: Record<SiteBanner['theme'], { strip: string; cta: string }> = {
  volt: {
    strip: 'bg-volt text-storm',
    cta: 'bg-storm text-volt hover:bg-storm/85',
  },
  storm: {
    strip: 'bg-teal text-snow border-y border-arc/25',
    cta: 'bg-volt text-storm hover:brightness-105',
  },
  emergency: {
    strip: 'bg-emergency text-white',
    cta: 'bg-white text-emergency hover:bg-white/90',
  },
};

/**
 * Active site_banners strip (owner-managed promos). Server component —
 * fetches active banners inside their window; renders nothing when none.
 */
export async function BannerStrip() {
  const banners = await getActiveBanners();
  if (banners.length === 0) return null;

  return (
    <div>
      {banners.map((banner) => {
        const theme = themeStyles[banner.theme] ?? themeStyles.volt;
        return (
          <div key={banner.id} className={cn('px-4 py-3', theme.strip)}>
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center sm:justify-between sm:text-left">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {banner.headline}
                  {banner.body && (
                    <span className="ml-2 hidden font-normal opacity-80 md:inline">
                      {banner.body}
                    </span>
                  )}
                </span>
              </p>
              {banner.cta_text && banner.cta_url && (
                <Link
                  href={banner.cta_url}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-bold transition-all',
                    theme.cta,
                  )}
                >
                  {banner.cta_text}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
