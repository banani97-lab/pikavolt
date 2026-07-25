'use client';

import { loadStripe, type Stripe, type Appearance } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

/** Singleton Stripe.js loader (null when the publishable key is absent). */
export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

/** Payment Element appearance — volt-on-storm to match the brand. */
export const voltAppearance: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#ffe600',
    colorBackground: '#12121a',
    colorText: '#f8fafc',
    colorTextSecondary: '#9ca3af',
    colorTextPlaceholder: '#71717a',
    colorDanger: '#ff3b30',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    borderRadius: '8px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(255, 255, 255, 0.15)',
      backgroundColor: '#0a0a0f',
    },
    '.Input:focus': {
      border: '1px solid rgba(255, 230, 0, 0.6)',
      boxShadow: '0 0 0 3px rgba(255, 230, 0, 0.2)',
    },
    '.Label': { color: '#d4d4d8' },
    '.Tab': { border: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: '#0a0a0f' },
    '.Tab--selected': {
      border: '1px solid rgba(255, 230, 0, 0.6)',
      color: '#ffe600',
    },
  },
};
