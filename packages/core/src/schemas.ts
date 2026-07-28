/**
 * Zod schemas for the web API contracts — FROZEN CONTRACT.
 *
 * Feature agents implement /api routes that validate against these exact
 * shapes; the mobile app serializes to them.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// POST /api/payments/deposit
// ---------------------------------------------------------------------------

export const DepositRequestSchema = z.object({
  appointment: z.object({
    addressId: z.string().min(1),
    /** ISO 8601 timestamp of the chosen slot start. */
    scheduledStart: z.string().datetime({ offset: true }),
    serviceIds: z.array(z.string().min(1)).min(1),
    description: z.string(),
    /** Emergencies are click-to-call only — online booking is never an emergency. */
    isEmergency: z.literal(false).optional(),
    promoCode: z.string().optional(),
    /** Consent to auto-charge the saved card for the final payment. */
    autoChargeConsent: z.boolean(),
    termsAccepted: z.boolean(),
  }),
});
export type DepositRequest = z.infer<typeof DepositRequestSchema>;

export const DepositResponseSchema = z.object({
  appointmentId: z.string(),
  /**
   * Omitted when the deposit is fully waived (a 100%-off promo, or any promo
   * that drops the deposit below Stripe's $0.50 minimum) — there is no
   * PaymentIntent to confirm in that case.
   */
  paymentIntentClientSecret: z.string().optional(),
  depositCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  /** True when no payment is due — the booking is confirmed without Stripe. */
  depositWaived: z.boolean().optional(),
});
export type DepositResponse = z.infer<typeof DepositResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/slots?date=YYYY-MM-DD
// ---------------------------------------------------------------------------

export const SlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be 'YYYY-MM-DD'"),
});
export type SlotsQuery = z.infer<typeof SlotsQuerySchema>;

export const SlotSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  available: z.boolean(),
});
export type SlotDto = z.infer<typeof SlotSchema>;

export const SlotsResponseSchema = z.object({
  slots: z.array(SlotSchema),
});
export type SlotsResponse = z.infer<typeof SlotsResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/payments/validate-promo
// ---------------------------------------------------------------------------

export const ValidatePromoRequestSchema = z.object({
  code: z.string().min(1),
});
export type ValidatePromoRequest = z.infer<typeof ValidatePromoRequestSchema>;

export const ValidatePromoResponseSchema = z.object({
  valid: z.boolean(),
  discountCents: z.number().int().nonnegative().optional(),
  percentOff: z.number().min(0).max(100).optional(),
  code: z.string(),
});
export type ValidatePromoResponse = z.infer<typeof ValidatePromoResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/payments/final
// ---------------------------------------------------------------------------

export const FinalPaymentResponseSchema = z.object({
  status: z.enum(['charged', 'payment_link_sent', 'requires_action']),
  paymentIntentClientSecret: z.string().optional(),
});
export type FinalPaymentResponse = z.infer<typeof FinalPaymentResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/tracking/eta
// ---------------------------------------------------------------------------

export const EtaResponseSchema = z.object({
  etaSeconds: z.number().int().nonnegative(),
  distanceMeters: z.number().int().nonnegative(),
  updatedAt: z.string().datetime({ offset: true }),
});
export type EtaResponse = z.infer<typeof EtaResponseSchema>;
