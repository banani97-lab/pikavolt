import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  HandCoins,
  BadgeCheck,
  ShieldCheck,
  Clock,
  Zap,
  Tractor,
  CalendarCheck,
} from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Reveal, RevealItem } from '@/components/marketing/Reveal';
import { SectionHeading } from '@/components/marketing/SectionHeading';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Pikavolt LLC is a Central Ohio electrical contractor delivering safe, dependable, code-compliant electrical work for homes, farms, and businesses — with honest communication and 24/7 emergency service.',
};

/** Owner value props verbatim (docs/owner-content.md). */
const VALUES = [
  { icon: HandCoins, label: 'Honest Pricing' },
  { icon: BadgeCheck, label: 'High-Quality Workmanship' },
  { icon: ShieldCheck, label: 'Code-Compliant Installations' },
  { icon: Clock, label: 'Fast Response Times' },
  { icon: Zap, label: 'Free Estimates' },
  { icon: Tractor, label: 'Residential • Commercial • Agricultural' },
];

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

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 bg-storm-gradient">
        <Container className="grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-arc">
              About Pikavolt LLC
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-4xl uppercase leading-tight tracking-wide text-snow sm:text-5xl">
              Your Trusted <span className="text-volt">Electrical Contractor</span>
            </h1>

            {/* Owner copy — verbatim from docs/owner-content.md */}
            <div className="mt-6 max-w-2xl space-y-4 text-base leading-relaxed text-muted">
              <p>
                At Pikavolt LLC, we believe every electrical project deserves quality
                craftsmanship and attention to detail. Whether it&apos;s a residential
                service upgrade, commercial installation, farm electrical work, or
                troubleshooting, our goal is to deliver safe, dependable, and
                code-compliant electrical solutions.
              </p>
              <p>
                We take pride in honest communication, reliable scheduling, and
                treating every property as if it were our own.
              </p>
              <p>
                At Pikavolt LLC, we provide professional electrical installations,
                upgrades, repairs, and service throughout Central Ohio. We focus on
                quality workmanship, safety, and dependable service.
              </p>
            </div>
          </div>

          <div className="relative mx-auto lg:mx-0">
            <div className="animate-float">
              <Image
                src="/mascot.png"
                alt="The Pikavolt mascot — a golden electrician critter with a lightning-bolt tail, pliers, and a screwdriver"
                width={690}
                height={1028}
                priority
                className="h-auto w-52 drop-shadow-[0_24px_48px_rgba(8,26,33,0.9)] sm:w-60 lg:w-72"
              />
            </div>
            <div
              className="absolute -bottom-4 left-1/2 h-5 w-3/4 -translate-x-1/2 rounded-[100%] bg-black/50 blur-lg"
              aria-hidden="true"
            />
          </div>
        </Container>
      </section>

      {/* Values */}
      <section className="border-b border-white/10">
        <Container className="py-16">
          <Reveal>
            <SectionHeading
              kicker="What we stand for"
              title={
                <>
                  Safe. Reliable. <span className="text-volt">Professional.</span>
                </>
              }
            />
          </Reveal>
          <Reveal stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map(({ icon: Icon, label }) => (
              <RevealItem key={label}>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface px-5 py-4 transition-colors hover:border-volt/30">
                  <Icon className="h-5 w-5 shrink-0 text-volt" aria-hidden="true" />
                  <span className="text-sm font-semibold text-snow">{label}</span>
                </div>
              </RevealItem>
            ))}
          </Reveal>
        </Container>
      </section>

      {/* Industries */}
      <section className="border-b border-white/10 bg-surface/40">
        <Container className="py-16">
          <Reveal>
            <SectionHeading
              kicker="Who we work with"
              title={
                <>
                  Industries We <span className="text-volt">Serve</span>
                </>
              }
            />
          </Reveal>
          <Reveal className="mt-8 flex max-w-4xl flex-wrap gap-2.5">
            {INDUSTRIES.map((industry) => (
              <span
                key={industry}
                className="rounded-full border border-white/15 bg-storm/60 px-4 py-1.5 text-sm text-muted"
              >
                {industry}
              </span>
            ))}
          </Reveal>
        </Container>
      </section>

      {/* CTA */}
      <Container className="py-16 text-center">
        <Reveal>
          <h2 className="font-display text-3xl uppercase tracking-wide text-snow">
            Powering Homes, Farms &amp; <span className="text-volt">Businesses</span>
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/book"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-volt px-7 font-bold text-storm transition-all hover:shadow-volt-glow"
            >
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              Book a Service
            </Link>
            <Link
              href="/services"
              className="text-sm font-semibold text-arc hover:text-volt"
            >
              Explore our services
            </Link>
          </div>
        </Reveal>
      </Container>
    </>
  );
}
