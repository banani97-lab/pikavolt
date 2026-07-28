import { EmergencyBanner } from '@/components/layout/EmergencyBanner';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import type { HeaderUser } from '@/components/layout/AccountMenu';
import { createClient } from '@/lib/supabase/server';

/**
 * Standard consumer-site chrome. Applied per route group ((marketing), (app),
 * (auth)) rather than in the root layout so /admin renders its own shell
 * without needing to suppress this one.
 */
export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let headerUser: HeaderUser | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    headerUser = { email: user.email ?? '', fullName: profile?.full_name ?? null };
  }

  return (
    <>
      <EmergencyBanner />
      <Header user={headerUser} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
    </>
  );
}
