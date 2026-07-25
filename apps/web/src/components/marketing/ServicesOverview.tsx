import Link from 'next/link';
import {
  Home,
  Building2,
  Tractor,
  Wrench,
  PlugZap,
  Shovel,
  UtilityPole,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import type { DbServiceCategory } from '@/lib/marketingData';
import { SERVICE_CATEGORIES } from '@/lib/serviceCategories';
import { SectionHeading } from './SectionHeading';
import { Reveal, RevealItem } from './Reveal';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  residential: Home,
  commercial: Building2,
  agricultural: Tractor,
  'repair-maintenance': Wrench,
  specialty: PlugZap,
  'underground-site-work': Shovel,
  'service-utility-work': UtilityPole,
};

function itemCount(slug: string): number | null {
  const match = SERVICE_CATEGORIES.find((c) => c.slug === slug);
  return match ? match.items.length : null;
}

/** 7 service-category cards with icon + hover arc, linking to /services/[slug]. */
export function ServicesOverview({ categories }: { categories: DbServiceCategory[] }) {
  return (
    <section className="border-b border-white/10">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="What we do"
            title={
              <>
                Every Kind of <span className="text-volt">Electrical Work</span>
              </>
            }
            description="Seven service categories, one standard of craft. From a single outlet to a whole-farm power distribution — explore what we can do for you."
          />
        </Reveal>

        <Reveal stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const Icon = CATEGORY_ICONS[category.slug] ?? PlugZap;
            const count = itemCount(category.slug);
            return (
              <RevealItem key={category.slug} className="h-full">
                <Link
                  href={`/services/${category.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-arc/50 hover:shadow-arc-glow"
                >
                  {/* hover arc: electric line racing across the top edge */}
                  <span
                    className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-linear-to-r from-volt via-arc to-transparent transition-transform duration-500 group-hover:scale-x-100"
                    aria-hidden="true"
                  />
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-teal-deep/60 text-amber transition-colors duration-300 group-hover:border-arc/40 group-hover:text-arc">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-display text-lg uppercase tracking-wide text-snow">
                    {category.name}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                    {category.description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-volt">
                    {count ? `${count} services` : 'View services'}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </RevealItem>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
