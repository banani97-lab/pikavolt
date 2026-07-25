import { SiteChrome } from '@/components/layout/SiteChrome';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
