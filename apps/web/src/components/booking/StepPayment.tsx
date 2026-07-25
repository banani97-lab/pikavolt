'use client';

import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCents } from './format';
import { getStripePromise, voltAppearance } from './stripeElements';

interface StepPaymentProps {
  clientSecret: string;
  depositCents: number;
  discountCents: number;
  onPaid: () => void;
}

export function StepPayment(props: StepPaymentProps) {
  return (
    <Elements
      stripe={getStripePromise()}
      options={{ clientSecret: props.clientSecret, appearance: voltAppearance }}
    >
      <DepositForm {...props} />
    </Elements>
  );
}

function DepositForm({ depositCents, discountCents, onPaid }: StepPaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/appointments`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed — try another card.');
      setSubmitting(false);
      return;
    }
    if (paymentIntent && ['succeeded', 'processing'].includes(paymentIntent.status)) {
      onPaid();
      return;
    }
    setError('Payment was not completed — please try again.');
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-surface p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Deposit payment
          </h3>
          <p className="text-lg font-bold text-volt">{formatCents(depositCents)}</p>
        </div>
        {discountCents > 0 && (
          <p className="mb-4 text-sm text-volt">Includes your {formatCents(discountCents)} promo discount.</p>
        )}
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {error && <p className="text-sm text-emergency">{error}</p>}

      <Button size="lg" className="w-full" onClick={pay} disabled={!stripe || submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Processing…
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" /> Pay {formatCents(depositCents)} deposit
          </>
        )}
      </Button>
      <p className="text-center text-xs text-zinc-500">
        Payments are processed securely by Stripe. Your slot is held while you pay.
      </p>
    </div>
  );
}
