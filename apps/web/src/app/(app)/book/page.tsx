import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { createClient } from '@/lib/supabase/server';
import { getBookingSettings } from '@/lib/appointments';
import { BookingWizard } from '@/components/booking/BookingWizard';
import type { AddressOption, CategoryOption } from '@/components/booking/types';

export const metadata: Metadata = { title: 'Book a Service Call' };

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function BookPage({ searchParams }: PageProps) {
  const { category } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/book');

  const [{ data: categoriesRaw }, { data: addressesRaw }, settings] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id, slug, name, description, services ( id, name, is_active, sort_order )')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('addresses')
      .select('id, label, line1, line2, city, state, zip, property_type, is_default')
      .order('is_default', { ascending: false })
      .order('created_at'),
    getBookingSettings(),
  ]);

  const categories: CategoryOption[] = (categoriesRaw ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    services: (c.services ?? [])
      .filter((s: { is_active: boolean }) => s.is_active)
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
  }));

  const addresses: AddressOption[] = (addressesRaw ?? []) as AddressOption[];

  return (
    <Container className="py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl uppercase tracking-wide text-white sm:text-4xl">
          Book a <span className="text-volt">Service Call</span>
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          ${(settings.serviceCallFeeCents / 100).toFixed(0)} service call fee — pay a{' '}
          {settings.depositPercent}% deposit now, the rest (plus any job work) when the job is
          done.
        </p>
      </div>
      <BookingWizard
        categories={categories}
        addresses={addresses}
        config={{
          serviceCallFeeCents: settings.serviceCallFeeCents,
          depositPercent: settings.depositPercent,
          bookingHorizonDays: settings.bookingHorizonDays,
          cancellationWindowHours: settings.cancellationWindowHours,
        }}
        initialCategorySlug={category}
      />
    </Container>
  );
}
