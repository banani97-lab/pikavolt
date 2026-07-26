import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, MapPin } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/server';
import { AccountForm } from './AccountForm';
import { DeleteAccountSection } from './DeleteAccountSection';

export const metadata: Metadata = { title: 'Your Account' };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, email, marketing_opt_in')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <Container className="py-12">
      <h1 className="mb-8 font-display text-3xl uppercase tracking-wide text-white sm:text-4xl">
        Your <span className="text-volt">Account</span>
      </h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <AccountForm
              email={profile?.email ?? user.email ?? ''}
              fullName={profile?.full_name ?? ''}
              phone={profile?.phone ?? ''}
              marketingOptIn={profile?.marketing_opt_in ?? false}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Link
            href="/account/addresses"
            className="group flex items-center justify-between rounded-xl border border-white/10 bg-surface p-6 transition-all hover:border-volt/50 hover:shadow-volt-glow"
          >
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-volt" />
              <div>
                <p className="font-semibold text-white">Service addresses</p>
                <p className="text-sm text-zinc-400">
                  Manage the homes, shops, and barns we service for you.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-600 transition-colors group-hover:text-volt" />
          </Link>

          <Link
            href="/appointments"
            className="group flex items-center justify-between rounded-xl border border-white/10 bg-surface p-6 transition-all hover:border-volt/50 hover:shadow-volt-glow"
          >
            <div>
              <p className="font-semibold text-white">Appointments</p>
              <p className="text-sm text-zinc-400">Upcoming and past service calls.</p>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-600 transition-colors group-hover:text-volt" />
          </Link>
        </div>
      </div>

      <div className="max-w-2xl">
        <DeleteAccountSection />
      </div>
    </Container>
  );
}
