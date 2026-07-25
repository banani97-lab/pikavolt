import { EmergencyBanner } from '@/components/layout/EmergencyBanner';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

/**
 * Standard consumer-site chrome. Applied per route group ((marketing), (app),
 * (auth)) rather than in the root layout so /admin renders its own shell
 * without needing to suppress this one.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EmergencyBanner />
      <Header />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
    </>
  );
}
