import Link from 'next/link';
import Image from 'next/image';
import { CalendarCheck, PhoneCall } from 'lucide-react';
import { Reveal } from './Reveal';

/** Closing band: mascot face + primary tagline + book/call actions. */
export function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 90% at 50% 100%, var(--color-teal) 0%, var(--color-teal-deep) 50%, transparent 100%)',
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <Reveal>
          <Image
            src="/mascot-face.png"
            alt=""
            width={112}
            height={112}
            className="mx-auto h-24 w-24 rounded-full border-2 border-volt/70 shadow-volt-glow"
            aria-hidden="true"
          />
          <h2 className="mx-auto mt-8 max-w-3xl font-display text-4xl uppercase leading-tight tracking-wide text-snow sm:text-5xl">
            Ready to <span className="text-volt text-volt-glow">Power Up</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            Safe. Reliable. Professional. Book a service call online, or reach us any
            hour for emergencies.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <span className="rounded-[14px] bg-linear-to-br from-volt to-amber p-px shadow-volt-glow transition-shadow hover:shadow-volt-glow-lg">
              <Link
                href="/book"
                className="inline-flex h-13 items-center gap-2 rounded-[13px] bg-volt px-8 text-base font-bold text-storm transition-all hover:brightness-105"
              >
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                Book a Service
              </Link>
            </span>
            <a
              href="tel:+16144010766"
              className="inline-flex h-13 items-center gap-2 rounded-[13px] border border-emergency/70 bg-emergency/10 px-8 text-base font-bold text-white transition-all hover:bg-emergency hover:shadow-emergency-glow"
            >
              <PhoneCall className="h-5 w-5 text-emergency" aria-hidden="true" />
              (614) 401-0766
            </a>
          </div>
          <p className="mt-6 text-xs text-muted">
            $150 service call fee — 50% due at booking, 50% on completion. Free
            estimates.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
