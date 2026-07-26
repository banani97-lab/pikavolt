/**
 * Pikavolt LLC brand tokens (TypeScript constants) — palette v2.
 *
 * Mascot-derived (see docs/brand.md). Dark theme IS the brand. Keep in sync
 * with tokens.css and the `@theme` block in apps/web/src/app/globals.css.
 */
export const brandColors = {
  /** Page background — near-black with a deep teal cast. */
  storm: '#081A21',
  /** Raised surfaces / cards — dark teal. */
  surface: '#0E2A33',
  /** Brand field color — exact mascot backdrop teal. */
  teal: '#2A5E73',
  /** Gradient partner / hover state on teal. */
  tealDeep: '#1B4254',
  /** Volt yellow — primary accent (CTAs, highlights). */
  volt: '#FFE600',
  /** Mascot fur gold — secondary accent (warm highlights, icons). */
  amber: '#DB9C38',
  /** Electric cyan — lightning accents. */
  arc: '#22D3EE',
  /** Electric arc gradient start (legacy M0 name; cyan family). */
  arcStart: '#22D3EE',
  /** Electric arc gradient end (legacy M0 name; cyan family). */
  arcEnd: '#7DF3FF',
  /** Danger / 24-7 emergency red. */
  emergency: '#FF3B30',
  /** Primary text. */
  text: '#F8FAFC',
  /** Muted text — tinted toward teal. */
  textMuted: '#9FB8C2',
  /** Subtle text — deeper teal-grey. */
  textSubtle: '#6C8894',
} as const;

export type BrandColorName = keyof typeof brandColors;

export const arcGradient = `linear-gradient(135deg, ${brandColors.arcStart}, ${brandColors.arcEnd})` as const;

export const stormGradient = `linear-gradient(to bottom, ${brandColors.teal}, ${brandColors.storm})` as const;

export const voltAmberGradient = `linear-gradient(135deg, ${brandColors.volt}, ${brandColors.amber})` as const;

export const voltGlowShadow = '0 0 24px rgb(255 230 0 / 0.35)' as const;

export const brandFonts = {
  /** Display font (headlines, logo wordmark) — loaded via next/font. */
  display: 'Anton',
  /** Body font — loaded via next/font. */
  body: 'Inter',
} as const;

export const brand = {
  name: 'Pikavolt LLC',
  taglinePrimary: 'Powering Ohio with Quality You Can Trust.',
  taglines: [
    'Powering Ohio with Quality You Can Trust.',
    'Where Quality Meets Reliability.',
    'Safe. Reliable. Professional.',
    'Powering Homes, Farms & Businesses.',
    'Your Trusted Electrical Contractor.',
  ],
  /** PLACEHOLDER — replace before launch (see docs/owner-content.md). */
  phone: '(614) 401-0766',
  phoneHref: 'tel:+16144010766',
  region: 'Central Ohio',
} as const;
