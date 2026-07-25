'use client';

import { useState } from 'react';
import { BadgePercent, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatApptStart, formatCents } from './format';
import { formatAddress, type AddressOption, type BookingConfig, type SlotChoice } from './types';

export interface PromoState {
  code: string;
  discountCents: number;
  percentOff?: number;
}

interface StepReviewProps {
  config: BookingConfig;
  serviceNames: string[];
  address: AddressOption | null;
  slot: SlotChoice | null;
  description: string;
  promo: PromoState | null;
  onPromoChange: (promo: PromoState | null) => void;
  termsAccepted: boolean;
  onTermsChange: (v: boolean) => void;
  autoChargeConsent: boolean;
  onAutoChargeChange: (v: boolean) => void;
}

export function StepReview({
  config,
  serviceNames,
  address,
  slot,
  description,
  promo,
  onPromoChange,
  termsAccepted,
  onTermsChange,
  autoChargeConsent,
  onAutoChargeChange,
}: StepReviewProps) {
  const [code, setCode] = useState(promo?.code ?? '');
  const [checking, setChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const fee = config.serviceCallFeeCents;
  const discount = promo?.discountCents ?? 0;
  const deposit = Math.max(Math.ceil((fee - discount) / 2), 0);

  const applyPromo = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setChecking(true);
    setPromoError(null);
    try {
      const res = await fetch('/api/payments/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const body = (await res.json()) as {
        valid: boolean;
        code: string;
        discountCents?: number;
        percentOff?: number;
      };
      if (res.ok && body.valid) {
        onPromoChange({
          code: body.code,
          discountCents: body.discountCents ?? 0,
          percentOff: body.percentOff,
        });
      } else {
        onPromoChange(null);
        setPromoError('That code isn’t valid or has expired.');
      }
    } catch {
      setPromoError('Could not check the code — try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-xl border border-white/10 bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
          Your service call
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Services</dt>
            <dd className="text-right text-white">{serviceNames.join(', ')}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">When</dt>
            <dd className="text-right text-white">{slot ? formatApptStart(slot.startsAt) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Where</dt>
            <dd className="text-right text-white">{address ? formatAddress(address) : '—'}</dd>
          </div>
          {description && (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Notes</dt>
              <dd className="max-w-[60%] text-right text-zinc-300">{description}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Service call fee</span>
            <span className="text-white">{formatCents(fee)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-volt">
              <span>
                Promo {promo?.code}
                {promo?.percentOff != null ? ` (${promo.percentOff}% off)` : ''}
              </span>
              <span>−{formatCents(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <span className="text-white">Deposit due today ({config.depositPercent}%)</span>
            <span className="text-volt">{formatCents(deposit)}</span>
          </div>
          <p className="pt-1 text-xs text-zinc-500">
            The remaining balance — the other half of the fee plus any job work — is due when the
            job is complete.
          </p>
        </div>
      </div>

      {/* Promo code */}
      <div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <BadgePercent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Promo code"
              className="pl-9 uppercase"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPromoError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
            />
          </div>
          <Button variant="ghost" onClick={applyPromo} disabled={checking || !code.trim()}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
          </Button>
        </div>
        {promoError && <p className="mt-1.5 text-sm text-emergency">{promoError}</p>}
        {promo && (
          <p className="mt-1.5 text-sm text-volt">
            {promo.code} applied — you save {formatCents(promo.discountCents)}.{' '}
            <button
              type="button"
              className="underline hover:text-white"
              onClick={() => {
                onPromoChange(null);
                setCode('');
              }}
            >
              Remove
            </button>
          </p>
        )}
      </div>

      {/* Consents */}
      <div className="space-y-3 rounded-xl border border-white/10 bg-surface p-5">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#ffe600]"
            checked={termsAccepted}
            onChange={(e) => onTermsChange(e.target.checked)}
          />
          <span>
            I agree to the service terms and the cancellation policy:{' '}
            <strong className="text-white">
              cancel at least {config.cancellationWindowHours} hours before my slot for a full
              deposit refund; later cancellations forfeit the deposit.
            </strong>{' '}
            <span className="text-zinc-500">(required)</span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#ffe600]"
            checked={autoChargeConsent}
            onChange={(e) => onAutoChargeChange(e.target.checked)}
          />
          <span>
            <strong className="text-white">Optional:</strong> save my card and automatically
            charge the final balance when the job is complete. If unchecked (or if the charge
            fails), we&apos;ll email you a secure payment link instead.
          </span>
        </label>
      </div>
    </div>
  );
}
