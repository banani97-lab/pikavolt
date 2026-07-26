import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Zap, CalendarCheck, PhoneCall, PlugZap } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { getCategoryWithServices } from '@/lib/marketingData';
import { SERVICE_CATEGORIES } from '@/lib/serviceCategories';
import { CATEGORY_ICONS } from '@/components/marketing/ServicesOverview';
import { Reveal } from '@/components/marketing/Reveal';

interface PageProps {
  params: Promise<{ category: string }>;
}

/** The 7 category slugs are fixed product decisions — prerender all of them. */
export function generateStaticParams() {
  return SERVICE_CATEGORIES.map((c) => ({ category: c.slug }));
}

export const revalidate = 3600;
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const data = await getCategoryWithServices(category);
  if (!data) return { title: 'Services' };
  return {
    title: `${data.category.name} — Central Ohio`,
    description: `${data.category.description ?? data.category.name} Professional, code-compliant electrical work across Central Ohio with free estimates and 24/7 emergency service.`,
  };
}

export default async function ServiceCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const data = await getCategoryWithServices(category);
  if (!data) notFound();

  const Icon = CATEGORY_ICONS[data.category.slug] ?? PlugZap;
  const services = data.services;
  const bookHref = `/book?category=${data.category.slug}`;

  return (
    <>
      {/* Category hero */}
      <section className="border-b border-white/10 bg-storm-gradient">
        <Container className="py-16 sm:py-20">
          <nav className="text-xs font-medium text-muted" aria-label="Breadcrumb">
            <Link href="/services" className="hover:text-volt">
              Services
            </Link>
            <span className="mx-2" aria-hidden="true">
              /
            </span>
            <span className="text-snow">{data.category.name}</span>
          </nav>
          <div className="mt-6 flex items-start gap-5">
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-arc/30 bg-teal-deep/60 text-arc sm:inline-flex">
              <Icon className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="max-w-3xl font-display text-4xl uppercase leading-tight tracking-wide text-snow sm:text-5xl">
                {data.category.name}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-muted">
                {data.category.description}
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <span className="rounded-[12px] bg-linear-to-br from-volt to-amber p-px shadow-volt-glow transition-shadow hover:shadow-volt-glow-lg">
              <Link
                href={bookHref}
                className="inline-flex h-12 items-center gap-2 rounded-[11px] bg-volt px-7 font-bold text-storm transition-all hover:brightness-105"
              >
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                Book this service
              </Link>
            </span>
            <a
              href="tel:+16144010766"
              className="inline-flex h-12 items-center gap-2 rounded-[11px] border border-white/15 px-7 font-semibold text-snow transition-colors hover:border-volt/50 hover:text-volt"
            >
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
              (614) 401-0766
            </a>
          </div>
        </Container>
      </section>

      {/* Full line-item list */}
      <Container className="py-16">
        <Reveal>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl uppercase tracking-wide text-snow">
              Everything We <span className="text-volt">Cover</span>
            </h2>
            <p className="text-sm text-muted">
              {services.length} services in this category
            </p>
          </div>
        </Reveal>
        <Reveal className="mt-8">
          <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <li
                key={service.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-snow/90 transition-colors hover:bg-surface"
              >
                <Zap className="h-3.5 w-3.5 shrink-0 fill-volt/80 text-volt/80" aria-hidden="true" />
                {service.name}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="mt-14">
          <div className="rounded-xl border border-white/10 bg-surface p-8 text-center sm:p-10">
            <h3 className="font-display text-2xl uppercase tracking-wide text-snow">
              Don&apos;t see exactly what you need?
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
              If it carries current, we handle it. Book a service call and describe the
              job — estimates are free. $150 service call fee, 50% due at booking.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={bookHref}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-volt px-7 font-bold text-storm transition-all hover:shadow-volt-glow"
              >
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                Book this service
              </Link>
              <Link
                href="/services"
                className="text-sm font-semibold text-arc hover:text-volt"
              >
                Browse all categories
              </Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </>
  );
}
