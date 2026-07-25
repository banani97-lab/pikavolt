import type { Metadata } from 'next';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Sweepstakes Official Rules',
  description: 'Official rules for Pikavolt LLC sweepstakes. No purchase necessary.',
  robots: { index: false },
};

/**
 * TODO(legal): This entire page is a DRAFT skeleton pending attorney review.
 * Do not launch a sweepstakes until counsel has approved final rules text.
 */
export default function SweepstakesRulesPage() {
  return (
    <Container className="max-w-3xl py-16">
      {/* Attorney-review TODO banner */}
      <div
        className="flex items-start gap-3 rounded-xl border border-amber/50 bg-amber/10 p-5"
        role="note"
      >
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-amber">
            Draft — pending attorney review
          </p>
          <p className="mt-1 text-sm text-muted">
            The rules below are a placeholder skeleton, not final legal terms. Final
            official rules will be published here before any sweepstakes opens for
            entry.
          </p>
        </div>
      </div>

      <h1 className="mt-10 font-display text-3xl uppercase tracking-wide text-snow sm:text-4xl">
        Sweepstakes <span className="text-volt">Official Rules</span>
      </h1>
      <p className="mt-4 text-lg font-bold uppercase tracking-wide text-snow">
        No purchase necessary to enter or win. A purchase will not increase your
        chances of winning.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="font-display text-lg uppercase tracking-wide text-snow">
            1. Sponsor
          </h2>
          <p className="mt-2">
            Pikavolt LLC, Central Ohio. [TODO: full legal address — attorney review.]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg uppercase tracking-wide text-snow">
            2. Eligibility
          </h2>
          <p className="mt-2">
            Open to legal residents of Ohio, 18 years or older at the time of entry.
            Employees of Pikavolt LLC and their immediate families are not eligible.
            [TODO: confirm eligibility scope — attorney review.]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg uppercase tracking-wide text-snow">
            3. Entry Period
          </h2>
          <p className="mt-2">
            The entry period for each sweepstakes is stated on the{' '}
            <Link href="/sweepstakes" className="text-arc hover:text-volt">
              sweepstakes page
            </Link>
            . [TODO: exact open/close timestamps — attorney review.]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg uppercase tracking-wide text-snow">
            4. How to Enter
          </h2>
          <p className="mt-2">
            Submit the entry form at pikavolt.com/sweepstakes with your name and email.
            Limit one (1) entry per person / email address per sweepstakes. No
            purchase, booking, or payment is required to enter.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg uppercase tracking-wide text-snow">
            5. Prize
          </h2>
          <p className="mt-2">
            The prize is described on the sweepstakes page. No cash substitution except
            at Sponsor&apos;s discretion. [TODO: ARV, substitution, and tax language —
            attorney review.]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg uppercase tracking-wide text-snow">
            6. Odds &amp; Winner Selection
          </h2>
          <p className="mt-2">
            Odds of winning depend on the number of eligible entries received. Winner
            will be selected at random after the entry period closes and notified by
            email. [TODO: notification window, forfeiture terms — attorney review.]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg uppercase tracking-wide text-snow">
            7. Publicity &amp; Privacy
          </h2>
          <p className="mt-2">
            Entry information is used solely to administer the sweepstakes. [TODO:
            publicity release and privacy policy reference — attorney review.]
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg uppercase tracking-wide text-snow">
            8. General Conditions
          </h2>
          <p className="mt-2">
            [TODO: disputes, limitation of liability, right to cancel or modify —
            attorney review.]
          </p>
        </section>
      </div>
    </Container>
  );
}
