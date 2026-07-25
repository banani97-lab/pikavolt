import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

/** Consistent marketing section heading: arc kicker + Anton display title. */
export function SectionHeading({
  kicker,
  title,
  description,
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn(align === 'center' && 'text-center', className)}>
      {kicker && (
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-arc">
          {kicker}
        </p>
      )}
      <h2 className="mt-3 font-display text-3xl uppercase tracking-wide text-snow sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            'mt-4 max-w-2xl text-base text-muted',
            align === 'center' && 'mx-auto',
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
