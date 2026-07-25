'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { PartyPopper, Zap, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

type Status = 'idle' | 'submitting' | 'success' | 'duplicate' | 'error';

/**
 * Public sweepstakes entry form. Inserts straight into sweepstakes_entries
 * with the anon browser client (RLS: public insert). The (sweepstakes_id,
 * email) unique constraint surfaces duplicates as Postgres 23505.
 */
export function SweepstakesForm({ sweepstakesId }: { sweepstakesId: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const reduced = useReducedMotion();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setErrorMessage(null);

    const form = new FormData(event.currentTarget);
    const entry = {
      sweepstakes_id: sweepstakesId,
      full_name: String(form.get('full_name') ?? '').trim(),
      email: String(form.get('email') ?? '').trim().toLowerCase(),
      phone: String(form.get('phone') ?? '').trim() || null,
      zip: String(form.get('zip') ?? '').trim() || null,
    };

    if (!entry.full_name || !entry.email) {
      setStatus('error');
      setErrorMessage('Please fill in your name and email.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from('sweepstakes_entries').insert(entry);

    if (!error) {
      setStatus('success');
      return;
    }
    if (error.code === '23505') {
      setStatus('duplicate');
      return;
    }
    setStatus('error');
    setErrorMessage('Something went wrong submitting your entry. Please try again.');
  }

  if (status === 'success' || status === 'duplicate') {
    return (
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 24 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        transition={
          reduced ? { duration: 0.3 } : { type: 'spring', stiffness: 200, damping: 16 }
        }
        className="rounded-xl border border-volt/30 bg-surface p-8 text-center shadow-volt-glow"
      >
        <div className="relative mx-auto h-28 w-28">
          <Image
            src="/mascot-face.png"
            alt=""
            width={112}
            height={112}
            className="h-28 w-28 rounded-full border-2 border-volt"
          />
          <Zap
            className="absolute -left-3 top-0 h-6 w-6 fill-volt text-volt animate-pulse-ring"
            aria-hidden="true"
          />
          <Zap
            className="absolute -right-3 bottom-1 h-5 w-5 fill-arc text-arc animate-pulse-ring"
            aria-hidden="true"
          />
        </div>
        {status === 'success' ? (
          <>
            <h2 className="mt-6 flex items-center justify-center gap-2 font-display text-2xl uppercase tracking-wide text-volt">
              <PartyPopper className="h-6 w-6" aria-hidden="true" />
              You&apos;re in!
            </h2>
            <p className="mt-3 text-sm text-muted">
              Your entry is recorded. We&apos;ll email the winner when the drawing
              happens — good luck!
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-6 font-display text-2xl uppercase tracking-wide text-snow">
              You&apos;re already entered
            </h2>
            <p className="mt-3 text-sm text-muted">
              Good news: that email already has an entry in this sweepstakes, so
              you&apos;re all set. One entry per person — fingers crossed!
            </p>
          </>
        )}
        <p className="mt-4 text-xs text-muted">
          <Link href="/sweepstakes/rules" className="text-arc hover:text-volt">
            Official rules
          </Link>
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-surface p-6 sm:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="sw-name">Full name</Label>
          <Input id="sw-name" name="full_name" autoComplete="name" required placeholder="Jane Buckeye" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="sw-email">Email</Label>
          <Input id="sw-email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </div>
        <div>
          <Label htmlFor="sw-phone">Phone (optional)</Label>
          <Input id="sw-phone" name="phone" type="tel" autoComplete="tel" placeholder="(614) 555-0000" />
        </div>
        <div>
          <Label htmlFor="sw-zip">ZIP (optional)</Label>
          <Input id="sw-zip" name="zip" inputMode="numeric" autoComplete="postal-code" placeholder="43017" />
        </div>
      </div>

      {status === 'error' && errorMessage && (
        <p className="mt-4 rounded-lg border border-emergency/40 bg-emergency/10 px-4 py-2.5 text-sm text-white" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-volt px-8 text-base font-bold text-storm transition-all hover:shadow-volt-glow disabled:pointer-events-none disabled:opacity-60"
      >
        {status === 'submitting' ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Entering…
          </>
        ) : (
          <>
            <Zap className="h-5 w-5" aria-hidden="true" />
            Enter the Sweepstakes
          </>
        )}
      </button>
      <p className="mt-4 text-center text-xs text-muted">
        No purchase necessary. One entry per person. See the{' '}
        <Link href="/sweepstakes/rules" className="text-arc hover:text-volt">
          official rules
        </Link>
        .
      </p>
    </form>
  );
}
