'use client';

import { Button } from '@/components/ui/Button';

interface GoogleButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export function GoogleButton({ onClick, disabled, label = 'Continue with Google' }: GoogleButtonProps) {
  return (
    <Button variant="ghost" className="w-full" onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.57-5.17 3.57-8.81Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.05 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.11A11.99 11.99 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.27A7.19 7.19 0 0 1 4.9 12c0-.79.14-1.55.37-2.27V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.11Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.28 6.62l3.99 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
        />
      </svg>
      {label}
    </Button>
  );
}
