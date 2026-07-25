import { SiteChrome } from '@/components/layout/SiteChrome';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
