import type { Metadata } from 'next';
import Link from 'next/link';
import { PhoneCall, Mail, MessageCircle, Clock, Trash2 } from 'lucide-react';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Get help with Pikavolt: call, email, or chat with us, and find answers on booking, payments, and managing your account.',
};

export default function SupportPage() {
  return (
    <>
      <section className="border-b border-white/10 bg-storm-gradient">
        <Container className="py-14 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-arc">Support</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl uppercase leading-tight tracking-wide text-snow sm:text-5xl">
            We&apos;re Here to <span className="text-volt">Help</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Questions about a booking, a payment, or your account? Reach a real person — no ticket
            queues.
          </p>
        </Container>
      </section>

      <Container className="max-w-4xl py-14">
        {/* Contact methods */}
        <div className="grid gap-5 sm:grid-cols-3">
          <a
            href="tel:+16145550199"
            className="group flex h-full flex-col rounded-xl border border-white/10 bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-volt/50 hover:shadow-volt-glow"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-volt/10 text-volt">
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-lg uppercase tracking-wide text-snow">Call</h2>
            <p className="mt-1 flex-1 text-sm text-muted">Fastest option. 24/7 for emergencies.</p>
            <span className="mt-3 font-bold text-volt">(614) 555-0199</span>
          </a>

          <a
            href="mailto:support@pikavolt.net"
            className="group flex h-full flex-col rounded-xl border border-white/10 bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-volt/50 hover:shadow-volt-glow"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-arc/10 text-arc">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-lg uppercase tracking-wide text-snow">Email</h2>
            <p className="mt-1 flex-1 text-sm text-muted">
              We reply within one business day.
            </p>
            <span className="mt-3 font-semibold text-arc">support@pikavolt.net</span>
          </a>

          <div className="flex h-full flex-col rounded-xl border border-white/10 bg-surface p-6">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-amber/10 text-amber">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-lg uppercase tracking-wide text-snow">Chat</h2>
            <p className="mt-1 flex-1 text-sm text-muted">
              Tap the mascot bubble in the corner of the site or app.
            </p>
            <span className="mt-3 text-sm font-semibold text-amber">Look for the bubble ↘</span>
          </div>
        </div>

        {/* Hours */}
        <div className="mt-10 rounded-xl border border-white/10 bg-surface p-6">
          <h2 className="flex items-center gap-2 font-display text-lg uppercase tracking-wide text-snow">
            <Clock className="h-5 w-5 text-amber" aria-hidden="true" />
            Hours
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-6 border-b border-white/10 pb-2">
              <dt className="text-muted">Monday – Friday</dt>
              <dd className="font-semibold text-snow">8:00 AM – 5:00 PM</dd>
            </div>
            <div className="flex justify-between gap-6 pb-2">
              <dt className="text-muted">Emergencies</dt>
              <dd className="font-semibold text-emergency">24/7 — every day</dd>
            </div>
          </dl>
        </div>

        {/* Common topics */}
        <div className="mt-12">
          <h2 className="font-display text-2xl uppercase tracking-wide text-snow">Common Questions</h2>
          <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted">
            <div>
              <h3 className="font-semibold text-snow">Booking a service call</h3>
              <p className="mt-1">
                Pick a time on the{' '}
                <Link href="/book" className="text-arc hover:text-volt">
                  booking page
                </Link>
                . A $150 service call fee applies, with 50% due as a deposit at booking and the
                balance after the work is done.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-snow">Payments &amp; receipts</h3>
              <p className="mt-1">
                Payments are handled securely by Stripe. If you consented to auto-charge at booking,
                your saved card is charged for the final balance when the job is complete; otherwise
                we send a secure payment link. Receipts are emailed automatically.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-snow">Rescheduling or cancelling</h3>
              <p className="mt-1">
                Need to change an appointment? Call or email us. Deposits are fully refundable when
                you cancel at least 24 hours before your scheduled time.
              </p>
            </div>
          </div>
        </div>

        {/* Account deletion */}
        <div id="delete-account" className="mt-12 scroll-mt-24 rounded-xl border border-white/10 bg-surface p-6">
          <h2 className="flex items-center gap-2 font-display text-xl uppercase tracking-wide text-snow">
            <Trash2 className="h-5 w-5 text-emergency" aria-hidden="true" />
            Deleting Your Account
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            You can permanently delete your Pikavolt account and personal data at any time. This
            removes your profile, saved addresses, appointment history, and chat messages from our
            systems and cannot be undone.
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 text-sm leading-relaxed text-muted">
            <div>
              <h3 className="font-semibold text-snow">In the mobile app</h3>
              <ol className="mt-2 ml-5 list-decimal space-y-1">
                <li>Open the <strong className="text-snow">Account</strong> tab.</li>
                <li>Scroll to <strong className="text-snow">Danger Zone</strong>.</li>
                <li>Tap <strong className="text-snow">Delete account</strong> and confirm.</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-snow">On the website</h3>
              <ol className="mt-2 ml-5 list-decimal space-y-1">
                <li>
                  Go to your{' '}
                  <Link href="/account" className="text-arc hover:text-volt">
                    account page
                  </Link>
                  .
                </li>
                <li>Open the <strong className="text-snow">Delete account</strong> section.</li>
                <li>Type <strong className="text-snow">DELETE</strong> to confirm.</li>
              </ol>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Prefer we do it for you? Email{' '}
            <a href="mailto:support@pikavolt.net" className="text-arc hover:text-volt">
              support@pikavolt.net
            </a>{' '}
            from your account email and we&apos;ll take care of it.
          </p>
        </div>

        <p className="mt-10 text-sm text-muted">
          See also our{' '}
          <Link href="/privacy" className="text-arc hover:text-volt">
            Privacy Policy
          </Link>
          .
        </p>
      </Container>
    </>
  );
}
