'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, PhoneCall, CalendarCheck } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/services', label: 'Services' },
  { href: '/service-areas', label: 'Service Areas' },
  { href: '/about', label: 'About' },
  { href: '/sweepstakes', label: 'Sweepstakes' },
  { href: '/contact', label: 'Contact' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-storm/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Pikavolt home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {navLinks.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative text-sm font-medium transition-colors hover:text-volt',
                  active ? 'text-volt' : 'text-muted',
                )}
              >
                {link.label}
                {active && (
                  <span
                    className="absolute -bottom-[21px] left-0 h-px w-full bg-linear-to-r from-volt to-arc"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="tel:+16145550199"
            className="hidden items-center gap-1.5 text-sm font-semibold text-snow transition-colors hover:text-volt lg:inline-flex"
          >
            <PhoneCall className="h-4 w-4 text-emergency" aria-hidden="true" />
            (614) 555-0199
          </a>
          <Link
            href="/login"
            className="hidden text-sm font-medium text-muted transition-colors hover:text-volt sm:inline"
          >
            Login
          </Link>
          <Link
            href="/book"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-volt px-4 text-sm font-bold text-storm shadow-volt-glow transition-all hover:shadow-volt-glow-lg hover:brightness-105"
          >
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            Book Now
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-snow transition-colors hover:border-volt/50 hover:text-volt md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-white/10 bg-storm/95 backdrop-blur md:hidden"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-3 sm:px-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-surface hover:text-volt',
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? 'text-volt'
                    : 'text-snow',
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium text-muted transition-colors hover:bg-surface hover:text-volt"
            >
              Login
            </Link>
            <a
              href="tel:+16145550199"
              className="mt-1 flex items-center gap-2 rounded-lg border border-emergency/50 bg-emergency/10 px-3 py-3 text-base font-semibold text-snow"
            >
              <PhoneCall className="h-4 w-4 text-emergency" aria-hidden="true" />
              24/7 Emergency: (614) 555-0199
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
