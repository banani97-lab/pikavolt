import Link from 'next/link';
import { PhoneCall, Clock } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { SERVICE_CATEGORIES } from '@/lib/serviceCategories';

const serviceAreas = [
  'Dublin',
  'Powell',
  'Marysville',
  'Delaware',
  'Hilliard',
  'Plain City',
  'Richwood',
  'Columbus',
  'Union County',
  'Delaware County',
];

const companyLinks = [
  { href: '/about', label: 'About' },
  { href: '/service-areas', label: 'Service Areas' },
  { href: '/contact', label: 'Contact' },
  { href: '/book', label: 'Book Now' },
  { href: '/sweepstakes', label: 'Sweepstakes' },
  { href: '/login', label: 'Customer Login' },
  { href: '/support', label: 'Support' },
  { href: '/privacy', label: 'Privacy Policy' },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {/* Brand */}
        <div className="space-y-4">
          <Logo />
          <p className="text-sm font-semibold text-volt">
            Powering Ohio with Quality You Can Trust.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            Safe. Reliable. Professional. Powering Homes, Farms &amp; Businesses
            across Central Ohio.
          </p>
          <a
            href="tel:+16145550199"
            className="inline-flex items-center gap-2 rounded-lg border border-emergency/50 bg-emergency/10 px-4 py-2.5 text-sm font-bold text-snow transition-colors hover:bg-emergency/20"
          >
            <PhoneCall className="h-4 w-4 text-emergency animate-pulse-ring" aria-hidden="true" />
            24/7 Emergency: (614) 555-0199
          </a>
        </div>

        {/* Services */}
        <div>
          <h3 className="mb-4 font-display text-sm uppercase tracking-wider text-snow">
            Services
          </h3>
          <ul className="space-y-2 text-sm">
            {SERVICE_CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/services/${category.slug}`}
                  className="text-muted transition-colors hover:text-volt"
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/services" className="font-semibold text-arc hover:text-volt">
                All services →
              </Link>
            </li>
          </ul>
        </div>

        {/* Areas */}
        <div>
          <h3 className="mb-4 font-display text-sm uppercase tracking-wider text-snow">
            Service Areas
          </h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted">
            {serviceAreas.map((area) => (
              <li key={area}>
                <Link href="/service-areas" className="transition-colors hover:text-volt">
                  {area}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted/70">…and surrounding areas.</p>
        </div>

        {/* Hours + company */}
        <div>
          <h3 className="mb-4 flex items-center gap-2 font-display text-sm uppercase tracking-wider text-snow">
            <Clock className="h-4 w-4 text-amber" aria-hidden="true" />
            Hours
          </h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Mon – Fri</dt>
              <dd className="font-medium text-snow">8 AM – 5 PM</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Emergencies</dt>
              <dd className="font-semibold text-emergency">24/7</dd>
            </div>
          </dl>
          <h3 className="mb-3 mt-8 font-display text-sm uppercase tracking-wider text-snow">
            Company
          </h3>
          <ul className="space-y-2 text-sm">
            {companyLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-muted transition-colors hover:text-volt">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <p className="mx-auto max-w-6xl px-4 text-center text-xs text-muted/80 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Pikavolt LLC — Residential • Commercial •
          Agricultural — Where Quality Meets Reliability.
        </p>
      </div>
    </footer>
  );
}
