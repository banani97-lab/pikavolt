import { Hero } from '@/components/marketing/Hero';
import { BannerStrip } from '@/components/marketing/BannerStrip';
import { ServicesOverview } from '@/components/marketing/ServicesOverview';
import { ValueProps } from '@/components/marketing/ValueProps';
import { IndustriesMarquee } from '@/components/marketing/IndustriesMarquee';
import { ServiceAreaSection } from '@/components/marketing/ServiceAreaSection';
import { Testimonials } from '@/components/marketing/Testimonials';
import { FinalCTA } from '@/components/marketing/FinalCTA';
import { getServiceCategories } from '@/lib/marketingData';

/** Re-generate every 5 minutes so owner banner changes surface quickly. */
export const revalidate = 300;

export default async function HomePage() {
  const categories = await getServiceCategories();

  return (
    <>
      <Hero />
      <BannerStrip />
      <ValueProps />
      <ServicesOverview categories={categories} />
      <IndustriesMarquee />
      <ServiceAreaSection />
      <Testimonials />
      <FinalCTA />
    </>
  );
}
