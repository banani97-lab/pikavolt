import { Zap } from 'lucide-react';

/** Industries verbatim from docs/owner-content.md. */
const INDUSTRIES = [
  'Homeowners',
  'Builders',
  'General Contractors',
  'Property Managers',
  'Apartment Complexes',
  'Horse Farms',
  'Agricultural Facilities',
  'Retail Stores',
  'Restaurants',
  'Offices',
  'Warehouses',
  'Churches',
  'Industrial Facilities',
];

/**
 * Infinite CSS marquee of the industries we serve. Pure CSS animation
 * (animate-marquee) — globals.css disables it under prefers-reduced-motion,
 * leaving a static scrollable strip.
 */
export function IndustriesMarquee() {
  return (
    <section className="border-b border-white/10 bg-teal-deep/30 py-10">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-arc">
        Industries we serve
      </p>
      <div className="mask-fade-x mt-6 overflow-hidden">
        <ul className="flex w-max animate-marquee items-center gap-8 pr-8">
          {[0, 1].map((copy) =>
            INDUSTRIES.map((industry) => (
              <li
                key={`${copy}-${industry}`}
                className="flex items-center gap-8 whitespace-nowrap"
                aria-hidden={copy === 1 ? true : undefined}
              >
                <span className="font-display text-xl uppercase tracking-wider text-snow/80">
                  {industry}
                </span>
                <Zap className="h-4 w-4 fill-volt/70 text-volt/70" aria-hidden="true" />
              </li>
            )),
          )}
        </ul>
      </div>
    </section>
  );
}
