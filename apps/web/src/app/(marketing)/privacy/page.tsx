import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Pikavolt LLC collects, uses, and protects your personal information across our website and mobile app.',
};

const LAST_UPDATED = 'July 25, 2026';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-lg uppercase tracking-wide text-snow">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="border-b border-white/10 bg-storm-gradient">
        <Container className="py-14 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-arc">Legal</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl uppercase leading-tight tracking-wide text-snow sm:text-5xl">
            Privacy <span className="text-volt">Policy</span>
          </h1>
          <p className="mt-4 text-sm text-muted">Last updated: {LAST_UPDATED}</p>
        </Container>
      </section>

      <Container className="max-w-3xl py-14">
        <div className="space-y-8 text-sm leading-relaxed text-muted">
          <p>
            This Privacy Policy explains how Pikavolt LLC (&ldquo;Pikavolt,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us&rdquo;) collects, uses, and shares personal information when you use our website
            at pikavolt.net and our Pikavolt mobile app (together, the &ldquo;Services&rdquo;). By
            using the Services you agree to this policy.
          </p>

          <Section id="info-we-collect" title="1. Information We Collect">
            <p>We collect the following information when you use the Services:</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong className="text-snow">Account information</strong> — your name, email
                address, phone number, and password (passwords are stored in hashed form by our
                authentication provider, never in plain text).
              </li>
              <li>
                <strong className="text-snow">Service addresses</strong> — the street addresses of
                the homes, businesses, or farms we service for you, the property type, and the
                approximate map coordinates (latitude/longitude) of those addresses.
              </li>
              <li>
                <strong className="text-snow">Appointment details</strong> — the services you
                request, your descriptions of the work, scheduling, and job notes.
              </li>
              <li>
                <strong className="text-snow">Payment information</strong> — we use Stripe to process
                payments. Your full card number is entered directly into Stripe and is never
                received or stored on our servers. We retain only non-sensitive records such as a
                Stripe customer reference, payment amounts, and payment status.
              </li>
              <li>
                <strong className="text-snow">Communications</strong> — messages you send through our
                in-app/website chat, and (for chat started without an account) any name or email you
                provide.
              </li>
              <li>
                <strong className="text-snow">Location information</strong> — see the dedicated
                section below.
              </li>
              <li>
                <strong className="text-snow">Device &amp; technical data</strong> — a push
                notification token for your device (if you enable notifications) and standard log
                data such as IP address and app/browser type.
              </li>
              <li>
                <strong className="text-snow">Preferences</strong> — such as whether you opted in to
                marketing messages.
              </li>
            </ul>
          </Section>

          <Section id="location" title="2. Location Information">
            <p>
              Pikavolt offers live technician tracking so that, while your electrician is on the way
              to a scheduled appointment, you can see their location on a map and an estimated
              arrival time.
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong className="text-snow">Technician (business) device:</strong> When the
                technician taps &ldquo;On My Way&rdquo; for a trip, the technician&apos;s app shares
                that device&apos;s GPS location so the assigned customer can follow the arrival. This
                sharing starts when the trip begins and stops automatically when the technician marks
                the appointment as arrived, completed, or cancelled.
              </li>
              <li>
                <strong className="text-snow">Customers:</strong> The customer app does{' '}
                <strong className="text-snow">not</strong> collect or share the customer&apos;s
                location. Customers only view the technician&apos;s location during an active trip.
              </li>
            </ul>
            <p>
              Live location is transmitted in real time to the relevant customer and is not retained
              as a saved location history. You can decline or revoke location permission in your
              device settings at any time; doing so disables the live-tracking feature.
            </p>
          </Section>

          <Section id="how-we-use" title="3. How We Use Information">
            <p>We use the information above to:</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>schedule, provide, and manage electrical service appointments;</li>
              <li>process deposits and final payments and issue receipts;</li>
              <li>show live technician tracking and arrival estimates;</li>
              <li>send service-related notifications and emails (booking confirmations, status updates, receipts);</li>
              <li>respond to your chat messages and support requests;</li>
              <li>send marketing messages only if you have opted in (you can opt out anytime); and</li>
              <li>maintain the security and proper operation of the Services and comply with law.</li>
            </ul>
          </Section>

          <Section id="service-providers" title="4. Service Providers">
            <p>
              We share information with trusted service providers who process it on our behalf, only
              as needed to run the Services:
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li><strong className="text-snow">Supabase</strong> — database, authentication, and backend hosting.</li>
              <li><strong className="text-snow">Stripe</strong> — payment processing.</li>
              <li><strong className="text-snow">Google Maps Platform</strong> — maps, address geocoding, and traffic-aware arrival estimates.</li>
              <li><strong className="text-snow">Firebase Cloud Messaging (Google)</strong> — delivery of push notifications.</li>
              <li><strong className="text-snow">Resend</strong> — delivery of transactional and (if opted in) marketing email.</li>
              <li><strong className="text-snow">Vercel</strong> — website hosting.</li>
            </ul>
            <p>
              These providers are bound to protect your information and may use it only to provide
              services to us.
            </p>
          </Section>

          <Section id="sharing" title="5. How We Share Information">
            <p>
              We do <strong className="text-snow">not</strong> sell your personal information. We
              share it only: (a) with the service providers listed above; (b) between the customer
              and technician as needed to fulfill an appointment (for example, live location during a
              trip); (c) to comply with law, enforce our terms, or protect rights and safety; and (d)
              in connection with a business transfer (such as a merger or sale), subject to this
              policy.
            </p>
          </Section>

          <Section id="retention" title="6. Data Retention">
            <p>
              We keep your information for as long as your account is active or as needed to provide
              the Services and meet legal, tax, and accounting obligations. Payment and transaction
              records are also retained independently by Stripe as required for financial and legal
              purposes. When you delete your account (see below), we remove your account and
              associated personal data from our systems.
            </p>
          </Section>

          <Section id="your-rights" title="7. Your Choices &amp; Rights">
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong className="text-snow">Access &amp; update:</strong> View and edit your
                profile and saved addresses in your account at any time.
              </li>
              <li>
                <strong className="text-snow">Marketing opt-out:</strong> Turn off marketing messages
                in your account settings or via the unsubscribe link in any marketing email.
              </li>
              <li>
                <strong className="text-snow">Delete your account:</strong> You can permanently delete
                your account and personal data yourself — in the app under{' '}
                <em>Account → Danger Zone → Delete account</em>, or on the website at{' '}
                <Link href="/account" className="text-arc hover:text-volt">
                  your account page
                </Link>
                . This removes your profile, saved addresses, appointment history, and chat messages
                from our systems. See our{' '}
                <Link href="/support" className="text-arc hover:text-volt">
                  support page
                </Link>{' '}
                for step-by-step instructions.
              </li>
              <li>
                <strong className="text-snow">Location permission:</strong> Manage or revoke location
                access in your device settings.
              </li>
            </ul>
            <p>
              Depending on where you live, you may have additional rights over your personal
              information. Contact us using the details below to make a request.
            </p>
          </Section>

          <Section id="notifications" title="8. Push Notifications">
            <p>
              With your permission, we send push notifications about your appointments (such as
              confirmations, technician-on-the-way alerts, and receipts). You can turn notifications
              off at any time in your device settings.
            </p>
          </Section>

          <Section id="security" title="9. Security">
            <p>
              We use administrative and technical safeguards — including encryption in transit and
              access controls — to protect your information. No method of transmission or storage is
              completely secure, so we cannot guarantee absolute security.
            </p>
          </Section>

          <Section id="children" title="10. Children&apos;s Privacy">
            <p>
              The Services are intended for adults and are not directed to children. We do not
              knowingly collect personal information from children under 13. If you believe a child
              has provided us information, please contact us so we can remove it.
            </p>
          </Section>

          <Section id="changes" title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the
              &ldquo;Last updated&rdquo; date above and, where appropriate, provide additional notice.
            </p>
          </Section>

          <Section id="contact" title="12. Contact Us">
            <p>
              Questions about this policy or your information? Reach us at{' '}
              <a href="mailto:support@pikavolt.net" className="text-arc hover:text-volt">
                support@pikavolt.net
              </a>{' '}
              or <a href="tel:+16145550199" className="text-arc hover:text-volt">(614) 555-0199</a>.
            </p>
            <p>Pikavolt LLC, Central Ohio.</p>
          </Section>
        </div>
      </Container>
    </>
  );
}
