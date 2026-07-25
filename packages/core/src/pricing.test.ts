import { describe, expect, it } from 'vitest';
import {
  DEPOSIT_PERCENT,
  SERVICE_CALL_FEE_CENTS,
  computeDeposit,
  computeFinal,
} from './pricing.js';

describe('constants', () => {
  it('freeze the fee at $150 and the deposit at 50%', () => {
    expect(SERVICE_CALL_FEE_CENTS).toBe(15000);
    expect(DEPOSIT_PERCENT).toBe(50);
  });
});

describe('computeDeposit', () => {
  it('is half the fee with no discount ($75)', () => {
    expect(computeDeposit(SERVICE_CALL_FEE_CENTS)).toBe(7500);
    expect(computeDeposit(SERVICE_CALL_FEE_CENTS, 0)).toBe(7500);
  });

  it('applies the discount before halving', () => {
    expect(computeDeposit(15000, 2000)).toBe(6500); // (150 - 20) / 2 = 65
  });

  it('rounds half-cents up (ceil)', () => {
    expect(computeDeposit(15000, 4999)).toBe(5001); // 10001 / 2 = 5000.5 → 5001
    expect(computeDeposit(101, 0)).toBe(51);
  });

  it('clamps to zero when the discount exceeds the fee', () => {
    expect(computeDeposit(15000, 15000)).toBe(0);
    expect(computeDeposit(15000, 99999)).toBe(0);
  });

  it('rejects non-integer or negative cents', () => {
    expect(() => computeDeposit(150.5)).toThrow(RangeError);
    expect(() => computeDeposit(-1)).toThrow(RangeError);
    expect(() => computeDeposit(15000, -5)).toThrow(RangeError);
  });
});

describe('computeFinal', () => {
  it('charges the remainder after discount and deposit', () => {
    // $400 job, no discount, $75 deposit paid → $325.
    expect(computeFinal(40000, 0, 7500)).toBe(32500);
  });

  it('applies discounts', () => {
    expect(computeFinal(40000, 5000, 7500)).toBe(27500);
  });

  it('clamps to zero (never a negative charge)', () => {
    expect(computeFinal(15000, 15000, 7500)).toBe(0);
    expect(computeFinal(15000, 0, 99999)).toBe(0);
  });

  it('validates that the job total is at least the service call fee', () => {
    expect(() => computeFinal(14999, 0, 0)).toThrow(RangeError);
    expect(computeFinal(15000, 0, 0)).toBe(15000);
  });

  it('rejects non-integer or negative cents', () => {
    expect(() => computeFinal(40000.25, 0, 0)).toThrow(RangeError);
    expect(() => computeFinal(40000, -1, 0)).toThrow(RangeError);
    expect(() => computeFinal(40000, 0, -1)).toThrow(RangeError);
  });

  it('books-then-completes flow is consistent (deposit + final = total - discount)', () => {
    const discount = 2000;
    const deposit = computeDeposit(SERVICE_CALL_FEE_CENTS, discount);
    const jobTotal = 62300;
    const final = computeFinal(jobTotal, discount, deposit);
    expect(deposit + final).toBe(jobTotal - discount);
  });
});
