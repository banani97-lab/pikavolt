'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCents } from '@/components/booking/format';
import { getStripePromise, voltAppearance } from '@/components/booking/stripeElements';

interface PayFinalFormProps {
  appointmentId: string;
  clientSecret: string;
  amountCents: number;
}

/** Payment Element for the final balance (pay-link flow). */
export function PayFinalForm(props: PayFinalFormProps) {
  return (
    <Elements
      stripe={getStripePromise()}
      options={{ clientSecret: props.clientSecret, appearance: voltAppearance }}
    >
      <InnerForm {...props} />
    </Elements>
  );
}

function InnerForm({ appointmentId, amountCents }: PayFinalFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/appointments/${appointmentId}`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed — try another card.');
      setSubmitting(false);
      return;
    }
    if (paymentIntent && ['succeeded', 'processing'].includes(paymentIntent.status)) {
      setPaid(true);
      setTimeout(() => router.push(`/appointments/${appointmentId}`), 1200);
      return;
    }
    setError('Payment was not completed — please try again.');
    setSubmitting(false);
  };

  if (paid) {
    return (
      <p className="rounded-xl border border-volt/40 bg-volt/10 p-5 text-center text-volt">
        Payment received — thank you! Redirecting…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="text-sm text-emergency">{error}</p>}
      <Button size="lg" className="w-full" onClick={pay} disabled={!stripe || submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Processing…
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" /> Pay {formatCents(amountCents)}
          </>
        )}
      </Button>
    </div>
  );
}
