import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-storm disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-volt text-storm hover:shadow-volt-glow hover:brightness-105 active:brightness-95',
  ghost:
    'border border-white/15 bg-transparent text-white hover:border-volt/60 hover:text-volt hover:shadow-volt-glow',
  danger:
    'bg-emergency text-white hover:shadow-[0_0_24px_rgb(255_59_48_/_0.4)] hover:brightness-105 active:brightness-95',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
