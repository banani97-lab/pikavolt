import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'volt' | 'arc' | 'emergency' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  volt: 'bg-volt/15 text-volt border-volt/30',
  arc: 'bg-arc-start/15 text-arc-end border-arc-start/30',
  emergency: 'bg-emergency/15 text-emergency border-emergency/30',
  neutral: 'bg-white/5 text-zinc-300 border-white/15',
};

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
