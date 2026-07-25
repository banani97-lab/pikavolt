import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Trophy, Gift, CalendarCheck } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { SweepstakesForm } from '@/components/marketing/SweepstakesForm';
import { getActiveSweepstakes } from '@/lib/marketingData';

/** Always reflect the owner's current sweepstakes state. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sweepstakes',
  description:
    'Enter the Pikavolt LLC sweepstakes for a chance to win. No purchase necessary — from your Central Ohio electrician.',
};

export default async function SweepstakesPage() {
  const sweepstakes = await getActiveSweepstakes();

  if (!sweepstakes) {
    return (
      <section className="border-b border-white/10 bg-storm-gradient">
        <Container className="py-24 text-center">
          <Image
            src="/mascot-face.png"
            alt=""
            width={112}
            height={112}
            className="mx-auto h-24 w-24 rounded-full border-2 border-white/15 opacity-80 grayscale-[35%]"
            aria-hidden="true"
          />
          <h1 className="mt-8 font-display text-4xl uppercase tracking-wide text-snow sm:text-5xl">
            No Active <span className="text-volt">Sweepstakes</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            Nothing to enter right now — but the mascot is always cooking something
            up. Check back soon, or book a service in the meantime.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/book"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-volt px-7 font-bold text-storm transition-all hover:shadow-volt-glow"
            >
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              Book a Service
            </Link>
            <Link
              href="/sweepstakes/rules"
              className="text-sm font-semibold text-arc hover:text-volt"
            >
              Official rules
            </Link>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <>
      <section className="border-b border-white/10 bg-storm-gradient">
        <Container className="py-16 text-center sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-volt/40 bg-volt/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-volt">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Live sweepstakes
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl uppercase leading-tight tracking-wide text-snow sm:text-5xl">
            {sweepstakes.title}
          </h1>
          {sweepstakes.description && (
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
              {sweepstakes.description}
            </p>
          )}
          {sweepstakes.prize && (
            <p className="mx-auto mt-6 inline-flex max-w-2xl items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-5 py-3 text-sm font-semibold text-amber">
              <Gift className="h-5 w-5 shrink-0" aria-hidden="true" />
              Prize: {sweepstakes.prize}
            </p>
          )}
          {sweepstakes.ends_at && (
            <p className="mt-4 text-sm text-muted">
              Entries close{' '}
              {new Date(sweepstakes.ends_at).toLocaleDateString('en-US', {
                dateStyle: 'long',
              })}
              .
            </p>
          )}
        </Container>
      </section>

      <Container className="py-16">
        <div className="mx-auto max-w-xl">
          <SweepstakesForm sweepstakesId={sweepstakes.id} />
        </div>
      </Container>
    </>
  );
}
