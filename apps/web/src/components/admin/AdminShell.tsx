'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Clock,
  Users,
  CreditCard,
  FileText,
  BadgePercent,
  Megaphone,
  Gift,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOutAction } from '@/app/admin/actions';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

export function AdminShell({
  ownerName,
  unreadChats,
  children,
}: {
  ownerName: string;
  unreadChats: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/appointments', label: 'Appointments', icon: ClipboardList },
    { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
    { href: '/admin/availability', label: 'Availability', icon: Clock },
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/payments', label: 'Payments', icon: CreditCard },
    { href: '/admin/invoices', label: 'Invoices', icon: FileText },
    { href: '/admin/promotions', label: 'Promotions', icon: BadgePercent },
    { href: '/admin/banners', label: 'Banners', icon: Megaphone },
    { href: '/admin/sweepstakes', label: 'Sweepstakes', icon: Gift },
    { href: '/admin/chat', label: 'Chat', icon: MessageSquare, badge: unreadChats },
  ];

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link
        href="/admin"
        className="flex items-center gap-2 border-b border-white/10 px-5 py-4"
        onClick={() => setOpen(false)}
      >
        <Zap className="h-5 w-5 fill-volt text-volt" aria-hidden="true" />
        <span className="font-display text-lg uppercase tracking-wider text-white">
          Pikavolt <span className="text-volt">Admin</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Admin">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-volt/10 text-volt shadow-[inset_2px_0_0_0_theme(colors.volt)]'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emergency px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3 text-[11px] text-zinc-500">
        Powering Ohio with Quality You Can Trust.
      </div>
    </div>
  );

  return (
    <div data-admin-shell className="flex min-h-screen bg-storm">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-white/10 bg-surface/60 lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-white/10 bg-surface">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-storm/85 px-4 backdrop-blur lg:px-8">
          <button
            className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex-1 truncate text-sm text-zinc-400">
            Signed in as <span className="font-semibold text-white">{ownerName}</span>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-volt/60 hover:text-volt"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
