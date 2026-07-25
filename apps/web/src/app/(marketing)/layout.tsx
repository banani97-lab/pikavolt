import type { Metadata } from 'next';

import { SiteChrome } from '@/components/layout/SiteChrome';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Marketing-segment SEO defaults. Titles use the root template
 * ("%s | Pikavolt LLC"); every marketing page shares the mascot OpenGraph art.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  keywords: [
    'electrician Central Ohio',
    'electrical contractor Columbus Ohio',
    'residential electrician',
    'commercial electrician',
    'farm electrician Ohio',
    '24/7 emergency electrician',
    'EV charger installation Ohio',
    'panel upgrade Columbus',
    'Pikavolt',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Pikavolt LLC',
    locale: 'en_US',
    images: [
      {
        url: '/mascot.png',
        width: 690,
        height: 1028,
        alt: 'The Pikavolt mascot — your Central Ohio electrician',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/mascot.png'],
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
