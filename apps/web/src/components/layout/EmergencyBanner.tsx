import { Phone, Zap } from 'lucide-react';

/**
 * Slim top strip advertising 24/7 emergency service.
 * Emergency work is click-to-call only — no online emergency booking.
 * Phone number is a PLACEHOLDER — replace before launch.
 */
export function EmergencyBanner() {
  return (
    <a
      href="tel:+16144010766"
      className="group flex items-center justify-center gap-2 bg-emergency px-4 py-1.5 text-center text-xs font-semibold text-white transition-colors hover:bg-emergency/90 sm:text-sm"
    >
      <Zap
        className="h-3.5 w-3.5 fill-volt text-volt animate-pulse-ring"
        aria-hidden="true"
      />
      <span>
        24/7 Emergency Service —{' '}
        <span className="underline underline-offset-2 group-hover:decoration-volt">
          Call Now
        </span>
      </span>
      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="hidden font-bold sm:inline">(614) 401-0766</span>
    </a>
  );
}
