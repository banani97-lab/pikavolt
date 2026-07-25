import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, CalendarCheck, PhoneCall } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { OhioMap } from '@/components/marketing/OhioMap';
import { SERVICE_AREAS } from '@/components/marketing/ServiceAreaSection';
import { Reveal, RevealItem } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Service Areas — Central Ohio',
  description:
    'Pikavolt LLC serves Central Ohio: Dublin, Powell, Marysville, Delaware, Hilliard, Plain City, Richwood, Columbus, Union County, Delaware County, and surrounding areas.',
};

const CITIES = SERVICE_AREAS.filter((a) => !a.includes('County'));
const COUNTIES = SERVICE_AREAS.filter((a) => a.includes('County'));

export default function ServiceAreasPage() {
  return (
    <>
      <section className="border-b border-white/10 bg-storm-gradient">
        <Container className="py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-arc">
            Service Areas
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl uppercase leading-tight tracking-wide text-snow sm:text-5xl">
            Central Ohio Is <span className="text-volt">Our Territory</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Proudly serving the communities below — and surrounding areas. If
            you&apos;re close to the map, you&apos;re close enough. Give us a call.
          </p>
        </Container>
      </section>

      <Container className="grid items-center gap-12 py-16 lg:grid-cols-2">
        {/* Stylized coverage map */}
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface/60">
            <OhioMap className="h-auto w-full" />
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            Stylized coverage map — not to scale.
          </p>
        </Reveal>

        {/* Text list (the accessible source of truth) */}
        <div>
          <Reveal>
            <h2 className="font-display text-2xl uppercase tracking-wide text-snow">
              Cities We <span className="text-volt">Serve</span>
            </h2>
          </Reveal>
          <Reveal stagger className="mt-6 grid grid-cols-2 gap-3">
            {CITIES.map((city) => (
              <RevealItem key={city}>
                <span className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-surface px-4 py-3 text-sm font-medium text-snow">
                  <MapPin className="h-4 w-4 shrink-0 text-amber" aria-hidden="true" />
                  {city}
                </span>
              </RevealItem>
            ))}
          </Reveal>
          <Reveal className="mt-8">
            <h2 className="font-display text-2xl uppercase tracking-wide text-snow">
              Counties
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {COUNTIES.map((county) => (
                <span
                  key={county}
                  className="rounded-full border border-arc/30 bg-teal-deep/40 px-5 py-2 text-sm font-semibold text-arc"
                >
                  {county}
                </span>
              ))}
              <span className="rounded-full border border-dashed border-white/20 px-5 py-2 text-sm text-muted">
                …and surrounding areas
              </span>
            </div>
          </Reveal>
          <Reveal className="mt-10">
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/book"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-volt px-7 font-bold text-storm transition-all hover:shadow-volt-glow"
              >
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                Book a Service
              </Link>
              <a
                href="tel:+16145550199"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/15 px-7 font-semibold text-snow transition-colors hover:border-volt/50 hover:text-volt"
              >
                <PhoneCall className="h-5 w-5" aria-hidden="true" />
                (614) 555-0199
              </a>
            </div>
            <p className="mt-4 text-sm text-muted">
              Not sure if you&apos;re in range? Call us — we travel for the right job.
            </p>
          </Reveal>
        </div>
      </Container>
    </>
  );
}
