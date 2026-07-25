import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarPlus } from 'lucide-react';
import type { AppointmentStatus } from '@pikavolt/core';
import { Container } from '@/components/ui/Container';
import { createClient } from '@/lib/supabase/server';
import {
  AppointmentCard,
  type AppointmentListItem,
} from '@/components/appointments/AppointmentCard';

export const metadata: Metadata = { title: 'Your Appointments' };

interface RawAppointment {
  id: string;
  status: AppointmentStatus;
  scheduled_start: string;
  addresses: { line1: string; city: string } | null;
  appointment_services: Array<{ services: { name: string } | null }>;
}

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/appointments');

  const { data } = await supabase
    .from('appointments')
    .select(
      `id, status, scheduled_start,
       addresses:address_id ( line1, city ),
       appointment_services ( services ( name ) )`,
    )
    .order('scheduled_start', { ascending: false });

  const items: AppointmentListItem[] = ((data ?? []) as unknown as RawAppointment[]).map((a) => ({
    id: a.id,
    status: a.status,
    scheduled_start: a.scheduled_start,
    addressLine: a.addresses ? `${a.addresses.line1}, ${a.addresses.city}` : '',
    serviceNames: (a.appointment_services ?? [])
      .map((s) => s.services?.name)
      .filter((n): n is string => !!n),
  }));

  const now = Date.now();
  const isPast = (a: AppointmentListItem) =>
    ['closed', 'cancelled', 'no_show'].includes(a.status) ||
    new Date(a.scheduled_start).getTime() < now - 12 * 3_600_000;

  const upcoming = items.filter((a) => !isPast(a)).sort(
    (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
  );
  const past = items.filter(isPast);

  return (
    <Container className="py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl uppercase tracking-wide text-white sm:text-4xl">
          Your <span className="text-volt">Appointments</span>
        </h1>
        <Link
          href="/book"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-volt px-5 text-sm font-semibold text-storm transition-all hover:shadow-volt-glow hover:brightness-105"
        >
          <CalendarPlus className="h-4 w-4" /> Book a service call
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-500">
            No upcoming service calls —{' '}
            <Link href="/book" className="text-volt underline">
              book one now
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Past
          </h2>
          <div className="space-y-3">
            {past.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
