import type { Metadata } from 'next';
import Link from 'next/link';
import {
  PhoneCall,
  MessageCircle,
  CalendarCheck,
  Clock,
  MapPin,
  Siren,
} from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { SERVICE_AREAS } from '@/components/marketing/ServiceAreaSection';
import { Reveal, RevealItem } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Reach Pikavolt LLC, your Central Ohio electrician: call (614) 555-0199 any time — 24/7 for emergencies — chat with us on the site, or book a service call online.',
};

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-white/10 bg-storm-gradient">
        <Container className="py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-arc">
            Contact
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl uppercase leading-tight tracking-wide text-snow sm:text-5xl">
            Talk to a <span className="text-volt">Real Electrician</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            No contact forms, no ticket queues. Call, chat, or book — whichever gets
            your power back fastest.
          </p>
        </Container>
      </section>

      <Container className="py-16">
        <Reveal stagger className="grid gap-5 lg:grid-cols-3">
          {/* Call */}
          <RevealItem className="h-full">
            <a
              href="tel:+16145550199"
              className="group flex h-full flex-col rounded-xl border border-white/10 bg-surface p-7 transition-all duration-300 hover:-translate-y-1 hover:border-volt/50 hover:shadow-volt-glow"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-volt/10 text-volt">
                <PhoneCall className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-display text-xl uppercase tracking-wide text-snow">
                Call Us
              </h2>
              <p className="mt-2 flex-1 text-sm text-muted">
                Fastest way to reach us. Tap to call from your phone.
              </p>
              <span className="mt-5 text-lg font-bold text-volt">(614) 555-0199</span>
            </a>
          </RevealItem>

          {/* Chat */}
          <RevealItem className="h-full">
            <div className="flex h-full flex-col rounded-xl border border-white/10 bg-surface p-7">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-arc/10 text-arc">
                <MessageCircle className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-display text-xl uppercase tracking-wide text-snow">
                Chat With Us
              </h2>
              <p className="mt-2 flex-1 text-sm text-muted">
                Spot the mascot in the corner of your screen? That&apos;s our live
                chat — tap it and ask us anything.
              </p>
              <span className="mt-5 text-sm font-semibold text-arc">
                Look for the chat bubble ↘
              </span>
            </div>
          </RevealItem>

          {/* Book */}
          <RevealItem className="h-full">
            <Link
              href="/book"
              className="group flex h-full flex-col rounded-xl border border-white/10 bg-surface p-7 transition-all duration-300 hover:-translate-y-1 hover:border-volt/50 hover:shadow-volt-glow"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-amber/10 text-amber">
                <CalendarCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-display text-xl uppercase tracking-wide text-snow">
                Book Online
              </h2>
              <p className="mt-2 flex-1 text-sm text-muted">
                Pick a time that works and we&apos;ll be there. $150 service call fee,
                50% due at booking.
              </p>
              <span className="mt-5 text-sm font-bold text-volt">
                Book a service call →
              </span>
            </Link>
          </RevealItem>
        </Reveal>

        {/* Emergency strip */}
        <Reveal className="mt-8">
          <a
            href="tel:+16145550199"
            className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-emergency/50 bg-emergency/10 px-6 py-5 text-center transition-colors hover:bg-emergency/20"
          >
            <Siren className="h-6 w-6 text-emergency animate-pulse-ring" aria-hidden="true" />
            <span className="font-display text-lg uppercase tracking-wide text-snow">
              Electrical emergency? We answer <span className="text-emergency">24/7</span> — call now.
            </span>
          </a>
        </Reveal>

        {/* Hours + areas recap */}
        <div className="mt-14 grid gap-10 md:grid-cols-2">
          <Reveal>
            <h2 className="flex items-center gap-2 font-display text-xl uppercase tracking-wide text-snow">
              <Clock className="h-5 w-5 text-amber" aria-hidden="true" />
              Hours
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-6 border-b border-white/10 pb-2">
                <dt className="text-muted">Monday – Friday</dt>
                <dd className="font-semibold text-snow">8:00 AM – 5:00 PM</dd>
              </div>
              <div className="flex justify-between gap-6 border-b border-white/10 pb-2">
                <dt className="text-muted">Saturday – Sunday</dt>
                <dd className="font-semibold text-snow">Emergency calls</dd>
              </div>
              <div className="flex justify-between gap-6 pb-2">
                <dt className="text-muted">Emergencies</dt>
                <dd className="font-semibold text-emergency">24/7 — every day</dd>
              </div>
            </dl>
          </Reveal>
          <Reveal>
            <h2 className="flex items-center gap-2 font-display text-xl uppercase tracking-wide text-snow">
              <MapPin className="h-5 w-5 text-amber" aria-hidden="true" />
              Where We Work
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Proudly serving Central Ohio including{' '}
              {SERVICE_AREAS.join(', ')}, and surrounding areas.
            </p>
            <Link
              href="/service-areas"
              className="mt-4 inline-block text-sm font-semibold text-arc hover:text-volt"
            >
              See the coverage map →
            </Link>
          </Reveal>
        </div>
      </Container>
    </>
  );
}
