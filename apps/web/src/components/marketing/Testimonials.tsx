import { Star } from 'lucide-react';
import { SectionHeading } from './SectionHeading';
import { Reveal } from './Reveal';

/**
 * Tasteful placeholder until real reviews land — honest, on-brand, and not a
 * wall of fake five-star quotes.
 */
export function Testimonials() {
  return (
    <section className="border-b border-white/10 bg-surface/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="Word on the street"
            title={
              <>
                Reviews <span className="text-volt">Coming Soon</span>
              </>
            }
            align="center"
          />
        </Reveal>
        <Reveal className="mx-auto mt-10 max-w-xl">
          <div className="rounded-xl border border-dashed border-white/20 bg-storm/60 p-8 text-center">
            <div className="flex justify-center gap-1.5" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-6 w-6 text-volt/50" />
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              We&apos;d rather earn reviews than write them. Stories from our first
              Central Ohio customers will appear here soon — until then, judge us by
              our work.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
