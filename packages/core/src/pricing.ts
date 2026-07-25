/**
 * Pricing rules — FROZEN CONTRACT.
 *
 * Service call fee is $150; 50% is due as a deposit at booking, the
 * remaining 50% plus the job total is charged on completion.
 * All monetary values are integer cents.
 */

/** $150 service call fee, in cents. */
export const SERVICE_CALL_FEE_CENTS = 15000;

/** Percentage of the (discounted) fee due as a deposit at booking. */
export const DEPOSIT_PERCENT = 50;

function assertCents(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer (cents); got ${value}`);
  }
}

/**
 * Deposit due at booking: ceil((fee - discount) / 2), clamped to >= 0.
 */
export function computeDeposit(feeCents: number, discountCents = 0): number {
  assertCents('feeCents', feeCents);
  assertCents('discountCents', discountCents);
  return Math.max(Math.ceil((feeCents - discountCents) / 2), 0);
}

/**
 * Final charge on completion: max(jobTotal - discount - depositPaid, 0).
 *
 * `jobTotalCents` includes the service call fee and must be at least
 * SERVICE_CALL_FEE_CENTS.
 */
export function computeFinal(
  jobTotalCents: number,
  discountCents: number,
  depositPaidCents: number,
): number {
  assertCents('jobTotalCents', jobTotalCents);
  assertCents('discountCents', discountCents);
  assertCents('depositPaidCents', depositPaidCents);
  if (jobTotalCents < SERVICE_CALL_FEE_CENTS) {
    throw new RangeError(
      `jobTotalCents must be at least the service call fee (${SERVICE_CALL_FEE_CENTS}); got ${jobTotalCents}`,
    );
  }
  return Math.max(jobTotalCents - discountCents - depositPaidCents, 0);
}
