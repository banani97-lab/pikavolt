'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { StepServices } from './StepServices';
import { StepDescribe } from './StepDescribe';
import { StepAddress } from './StepAddress';
import { StepSlot } from './StepSlot';
import { StepReview, type PromoState } from './StepReview';
import { StepPayment } from './StepPayment';
import { formatApptStart, formatCents } from './format';
import type { AddressOption, BookingConfig, CategoryOption, SlotChoice } from './types';

const STEPS = ['Services', 'Details', 'Address', 'Time', 'Review', 'Pay'] as const;

interface DepositInfo {
  appointmentId: string;
  clientSecret: string | null;
  depositCents: number;
  discountCents: number;
  waived: boolean;
}

interface BookingWizardProps {
  categories: CategoryOption[];
  addresses: AddressOption[];
  config: BookingConfig;
  initialCategorySlug?: string;
}

export function BookingWizard({
  categories,
  addresses,
  config,
  initialCategorySlug,
}: BookingWizardProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [done, setDone] = useState(false);

  const [categorySlug, setCategorySlug] = useState<string | null>(
    initialCategorySlug && categories.some((c) => c.slug === initialCategorySlug)
      ? initialCategorySlug
      : (categories[0]?.slug ?? null),
  );
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((a) => a.is_default)?.id ?? null,
  );
  const [slot, setSlot] = useState<SlotChoice | null>(null);
  const [promo, setPromo] = useState<PromoState | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [autoChargeConsent, setAutoChargeConsent] = useState(false);

  const [deposit, setDeposit] = useState<DepositInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  const serviceNames = useMemo(
    () =>
      categories
        .flatMap((c) => c.services)
        .filter((s) => serviceIds.includes(s.id))
        .map((s) => s.name),
    [categories, serviceIds],
  );
  const selectedAddress = addresses.find((a) => a.id === addressId) ?? null;

  const canContinue = (() => {
    switch (step) {
      case 0:
        return serviceIds.length > 0;
      case 1:
        return description.trim().length > 0;
      case 2:
        return addressId != null;
      case 3:
        return slot != null;
      case 4:
        return termsAccepted;
      default:
        return false;
    }
  })();

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  /** Review → Pay: create the appointment + deposit PaymentIntent. */
  const startPayment = async () => {
    if (!addressId || !slot) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment: {
            addressId,
            scheduledStart: slot.startsAt,
            serviceIds,
            description: description.trim(),
            promoCode: promo?.code,
            autoChargeConsent,
            termsAccepted,
          },
        }),
      });
      const body = (await res.json()) as {
        appointmentId?: string;
        paymentIntentClientSecret?: string;
        depositCents?: number;
        discountCents?: number;
        depositWaived?: boolean;
        error?: string;
      };
      if (res.status === 409) {
        // Slot got taken between picking it and paying — back to the calendar.
        setSlot(null);
        setConflictNotice('That slot was just booked by someone else — please pick another time.');
        go(3);
        return;
      }
      // A fully-waived deposit (100%-off promo) has no client secret — the
      // booking is already confirmed server-side, so skip the payment step.
      const waived = body.depositWaived === true;
      if (!res.ok || !body.appointmentId || (!waived && !body.paymentIntentClientSecret)) {
        setCreateError(body.error ?? 'Could not start the payment — try again.');
        return;
      }
      setDeposit({
        appointmentId: body.appointmentId,
        clientSecret: body.paymentIntentClientSecret ?? null,
        depositCents: body.depositCents ?? 0,
        discountCents: body.discountCents ?? 0,
        waived,
      });
      if (waived) {
        setDone(true);
        return;
      }
      go(5);
    } catch {
      setCreateError('Could not start the payment — check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  if (done && deposit && slot) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-lg rounded-2xl border border-volt/30 bg-surface p-8 text-center shadow-volt-glow-lg"
      >
        <CheckCircle2 className="mx-auto h-14 w-14 text-volt" />
        <h2 className="mt-4 font-display text-2xl uppercase tracking-wide text-white">
          You&apos;re booked!
        </h2>
        <p className="mt-3 text-zinc-300">
          {deposit.waived ? (
            <>
              Your promo covered the deposit in full — no payment due. Your service call is requested
              for <strong className="text-white">{formatApptStart(slot.startsAt)}</strong>.
            </>
          ) : (
            <>
              Your {formatCents(deposit.depositCents)} deposit is in and your service call is
              requested for{' '}
              <strong className="text-white">{formatApptStart(slot.startsAt)}</strong>.
            </>
          )}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          We&apos;ll confirm shortly — watch your email for updates.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`/appointments/${deposit.appointmentId}`}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-lg bg-volt px-7 text-base font-semibold text-storm transition-all hover:shadow-volt-glow hover:brightness-105"
          >
            View appointment
          </Link>
          <Link
            href="/appointments"
            className="inline-flex h-13 items-center justify-center gap-2 rounded-lg border border-white/15 px-7 text-base font-semibold text-white transition-all hover:border-volt/60 hover:text-volt"
          >
            All appointments
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <ol className="mb-8 flex items-center gap-1 sm:gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <div
                className={cn(
                  'h-0.5 flex-1 rounded',
                  i === 0 ? 'bg-transparent' : i <= step ? 'bg-volt' : 'bg-white/10',
                )}
              />
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all',
                  i < step
                    ? 'border-volt bg-volt text-storm'
                    : i === step
                      ? 'border-volt bg-volt/15 text-volt shadow-volt-glow'
                      : 'border-white/15 text-zinc-500',
                )}
              >
                {i < step ? <Zap className="h-3.5 w-3.5 fill-storm" /> : i + 1}
              </div>
              <div
                className={cn(
                  'h-0.5 flex-1 rounded',
                  i === STEPS.length - 1 ? 'bg-transparent' : i < step ? 'bg-volt' : 'bg-white/10',
                )}
              />
            </div>
            <span
              className={cn(
                'hidden text-[11px] font-medium uppercase tracking-wide sm:block',
                i === step ? 'text-volt' : 'text-zinc-500',
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {/* Step body */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          initial={{ opacity: 0, x: 32 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 * direction }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {step === 0 && (
            <StepServices
              categories={categories}
              activeCategorySlug={categorySlug}
              selectedServiceIds={serviceIds}
              onCategoryChange={setCategorySlug}
              onToggleService={(id) =>
                setServiceIds((ids) =>
                  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
                )
              }
            />
          )}
          {step === 1 && <StepDescribe description={description} onChange={setDescription} />}
          {step === 2 && (
            <StepAddress
              addresses={addresses}
              selectedAddressId={addressId}
              onSelect={setAddressId}
            />
          )}
          {step === 3 && (
            <StepSlot
              horizonDays={config.bookingHorizonDays}
              selectedSlot={slot}
              onSelect={(s) => {
                setSlot(s);
                setConflictNotice(null);
              }}
              conflictNotice={conflictNotice}
            />
          )}
          {step === 4 && (
            <StepReview
              config={config}
              serviceNames={serviceNames}
              address={selectedAddress}
              slot={slot}
              description={description.trim()}
              promo={promo}
              onPromoChange={setPromo}
              termsAccepted={termsAccepted}
              onTermsChange={setTermsAccepted}
              autoChargeConsent={autoChargeConsent}
              onAutoChargeChange={setAutoChargeConsent}
            />
          )}
          {step === 5 && deposit && deposit.clientSecret && (
            <StepPayment
              clientSecret={deposit.clientSecret}
              depositCents={deposit.depositCents}
              discountCents={deposit.discountCents}
              onPaid={() => setDone(true)}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {createError && step === 4 && (
        <p className="mt-4 text-sm text-emergency">{createError}</p>
      )}

      {/* Nav */}
      {step < 5 && (
        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || creating}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < 4 ? (
            <Button onClick={() => go(step + 1)} disabled={!canContinue}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={startPayment} disabled={!canContinue || creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Setting up…
                </>
              ) : (
                <>
                  Continue to payment <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      )}
      {step === 5 && (
        <div className="mt-6">
          <p className="text-xs text-zinc-500">
            Changed your mind about the time? Your requested slot expires automatically if the
            deposit isn&apos;t paid within 30 minutes.
          </p>
        </div>
      )}
    </div>
  );
}
