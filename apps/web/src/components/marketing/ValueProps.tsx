import {
  HandCoins,
  BadgeCheck,
  ShieldCheck,
  Clock,
  Zap,
  Tractor,
  type LucideIcon,
} from 'lucide-react';
import { SectionHeading } from './SectionHeading';
import { Reveal, RevealItem } from './Reveal';

interface ValueProp {
  icon: LucideIcon;
  label: string;
  detail: string;
}

/** Owner value props verbatim (docs/owner-content.md). */
const VALUE_PROPS: ValueProp[] = [
  {
    icon: HandCoins,
    label: 'Honest Pricing',
    detail: 'Clear numbers before the work starts. No surprises on the invoice.',
  },
  {
    icon: BadgeCheck,
    label: 'High-Quality Workmanship',
    detail: 'Every project gets craftsmanship and attention to detail.',
  },
  {
    icon: ShieldCheck,
    label: 'Code-Compliant Installations',
    detail: 'Safe, dependable work that passes inspection the first time.',
  },
  {
    icon: Clock,
    label: 'Fast Response Times',
    detail: 'Reliable scheduling — and 24/7 response when it can’t wait.',
  },
  {
    icon: Zap,
    label: 'Free Estimates',
    detail: 'Tell us about the job and get an estimate at no cost.',
  },
  {
    icon: Tractor,
    label: 'Residential • Commercial • Agricultural',
    detail: 'Homes, businesses, and farms — one contractor for all of it.',
  },
];

export function ValueProps() {
  return (
    <section className="border-b border-white/10 bg-surface/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="Why Pikavolt"
            title={
              <>
                Where Quality Meets <span className="text-volt">Reliability</span>
              </>
            }
            align="center"
          />
        </Reveal>
        <Reveal stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {VALUE_PROPS.map(({ icon: Icon, label, detail }) => (
            <RevealItem key={label} className="h-full">
              <div className="group flex h-full items-start gap-4 rounded-xl border border-white/10 bg-storm/60 p-5 transition-colors duration-300 hover:border-volt/30">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-volt/10 text-volt transition-shadow duration-300 group-hover:shadow-volt-glow">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-snow">
                    {label}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{detail}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
