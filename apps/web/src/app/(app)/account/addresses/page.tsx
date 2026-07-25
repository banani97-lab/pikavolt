import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { createClient } from '@/lib/supabase/server';
import { AddressesManager } from './AddressesManager';
import type { AddressOption } from '@/components/booking/types';

export const metadata: Metadata = { title: 'Your Addresses' };

export default async function AddressesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account/addresses');

  const { data } = await supabase
    .from('addresses')
    .select('id, label, line1, line2, city, state, zip, property_type, is_default')
    .order('is_default', { ascending: false })
    .order('created_at');

  return (
    <Container className="py-12">
      <Link
        href="/account"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-volt"
      >
        <ArrowLeft className="h-4 w-4" /> Account
      </Link>
      <h1 className="mb-2 font-display text-3xl uppercase tracking-wide text-white sm:text-4xl">
        Service <span className="text-volt">Addresses</span>
      </h1>
      <p className="mb-8 max-w-2xl text-zinc-400">
        Homes, businesses, and farms we can dispatch to. Your default address is preselected when
        you book.
      </p>
      <AddressesManager addresses={(data ?? []) as AddressOption[]} />
    </Container>
  );
}
