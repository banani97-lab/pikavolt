import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';
import { SectionHeading } from './SectionHeading';
import { Reveal, RevealItem } from './Reveal';

/** Cities + counties verbatim from docs/owner-content.md. */
export const SERVICE_AREAS = [
  'Dublin',
  'Powell',
  'Marysville',
  'Delaware',
  'Hilliard',
  'Plain City',
  'Richwood',
  'Columbus',
  'Union County',
  'Delaware County',
];

export function ServiceAreaSection() {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      {/* faint radial "coverage" rings */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[60rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07]"
        style={{
          background:
            'repeating-radial-gradient(circle, transparent 0, transparent 78px, var(--color-arc) 80px)',
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="Where we work"
            title={
              <>
                Proudly Serving <span className="text-volt">Central Ohio</span>
              </>
            }
            description="Based in the heart of Ohio and on the road every day — from Columbus neighborhoods to Union County farms."
            align="center"
          />
        </Reveal>
        <Reveal stagger className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-3">
          {SERVICE_AREAS.map((area) => (
            <RevealItem key={area}>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-surface px-4 py-2 text-sm font-medium text-snow transition-colors hover:border-volt/50 hover:text-volt">
                <MapPin className="h-4 w-4 text-amber" aria-hidden="true" />
                {area}
              </span>
            </RevealItem>
          ))}
          <RevealItem>
            <span className="inline-flex items-center rounded-full border border-dashed border-white/20 px-4 py-2 text-sm text-muted">
              …and surrounding areas
            </span>
          </RevealItem>
        </Reveal>
        <Reveal className="mt-10 text-center">
          <Link
            href="/service-areas"
            className="inline-flex items-center gap-2 text-sm font-semibold text-arc hover:text-volt"
          >
            See our full coverage map
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
