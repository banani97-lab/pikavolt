import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, PlugZap } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { getServiceCategories } from '@/lib/marketingData';
import { CATEGORY_ICONS } from '@/components/marketing/ServicesOverview';
import { SERVICE_CATEGORIES } from '@/lib/serviceCategories';
import { Reveal, RevealItem } from '@/components/marketing/Reveal';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Electrical Services',
  description:
    'Residential, commercial, and agricultural electrical services across Central Ohio — panel upgrades, wiring, lighting, EV chargers, generators, and 24/7 emergency repairs. Free estimates.',
};

export default async function ServicesPage() {
  const categories = await getServiceCategories();

  return (
    <>
      <section className="border-b border-white/10 bg-storm-gradient">
        <Container className="py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-arc">
            Services
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl uppercase leading-tight tracking-wide text-snow sm:text-5xl">
            One Contractor for <span className="text-volt">Every Circuit</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Residential, commercial, and agricultural electrical work across Central
            Ohio. $150 service call fee — 50% due at booking, 50% on completion. Free
            estimates, always.
          </p>
        </Container>
      </section>

      <Container className="py-16">
        <Reveal stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const Icon = CATEGORY_ICONS[category.slug] ?? PlugZap;
            const count = SERVICE_CATEGORIES.find((c) => c.slug === category.slug)
              ?.items.length;
            return (
              <RevealItem key={category.slug} className="h-full">
                <Link
                  href={`/services/${category.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-arc/50 hover:shadow-arc-glow"
                >
                  <span
                    className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-linear-to-r from-volt via-arc to-transparent transition-transform duration-500 group-hover:scale-x-100"
                    aria-hidden="true"
                  />
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-teal-deep/60 text-amber transition-colors duration-300 group-hover:border-arc/40 group-hover:text-arc">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 font-display text-lg uppercase tracking-wide text-snow">
                    {category.name}
                  </h2>
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
      </Container>
    </>
  );
}
