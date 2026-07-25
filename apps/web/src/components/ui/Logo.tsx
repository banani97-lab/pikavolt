import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Renders the "PIKAVOLT" wordmark next to the bolt. */
  withWordmark?: boolean;
}

/**
 * Placeholder lightning bolt mark (owner has not supplied a logo yet).
 * Inline SVG mirror of /public/logo.svg so it inherits sizing via className.
 */
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="h-8 w-8 shrink-0"
      >
        <path
          d="M36 4 L14 36 H28 L24 60 L50 24 H34 L40 4 Z"
          fill="var(--color-volt)"
          stroke="var(--color-volt)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span className="font-display text-xl uppercase tracking-wide text-white">
          Pika<span className="text-volt">volt</span>
        </span>
      )}
    </span>
  );
}
