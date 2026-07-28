'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, ChevronDown, CircleUser, LogOut, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export type HeaderUser = {
  email: string;
  fullName: string | null;
};

/**
 * Signed-in account control for the site header. Replaces the "Login" link
 * once a session exists: shows the customer's name and a dropdown with their
 * appointments, account settings, and sign-out.
 */
export function AccountMenu({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const label = user.fullName?.trim() || user.email;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    await createClient().auth.signOut().catch(() => {});
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-sm font-medium text-snow transition-colors hover:border-volt/50 hover:text-volt"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CircleUser className="h-4 w-4" aria-hidden="true" />
        <span className="max-w-[10rem] truncate">{label}</span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-storm/95 shadow-xl backdrop-blur"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs text-muted">Signed in as</p>
            <p className="truncate text-sm font-medium text-snow">{user.email}</p>
          </div>
          <Link
            href="/appointments"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-snow transition-colors hover:bg-surface hover:text-volt"
          >
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            My Appointments
          </Link>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-snow transition-colors hover:bg-surface hover:text-volt"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Account settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 border-t border-white/10 px-4 py-3 text-left text-sm text-muted transition-colors hover:bg-surface hover:text-emergency disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
