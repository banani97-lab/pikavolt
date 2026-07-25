/**
 * Appointment lifecycle state machine — FROZEN CONTRACT.
 *
 * Other packages (web API routes, mobile app, db triggers) build against
 * these exact statuses and transition rules. Do not rename values.
 */

export const APPOINTMENT_STATUSES = [
  'requested',
  'confirmed',
  'en_route',
  'in_progress',
  'completed',
  'closed',
  'cancelled',
  'no_show',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const ACTORS = ['customer', 'owner', 'system'] as const;

export type Actor = (typeof ACTORS)[number];

/**
 * Transition table: `TRANSITIONS[from][to]` lists the actors allowed to
 * perform that transition. Absent entries are forbidden.
 */
export const TRANSITIONS: Readonly<
  Record<AppointmentStatus, Partial<Record<AppointmentStatus, readonly Actor[]>>>
> = {
  requested: {
    confirmed: ['owner'],
    cancelled: ['customer', 'owner'],
  },
  confirmed: {
    en_route: ['owner'],
    cancelled: ['customer', 'owner'],
  },
  en_route: {
    in_progress: ['owner'],
    cancelled: ['owner'],
    no_show: ['owner'],
  },
  in_progress: {
    completed: ['owner'],
    no_show: ['owner'],
    cancelled: ['owner'],
  },
  completed: {
    closed: ['system'],
  },
  closed: {},
  cancelled: {},
  no_show: {},
} as const;

/** Terminal statuses — no outgoing transitions. */
export const TERMINAL_STATUSES: readonly AppointmentStatus[] = [
  'closed',
  'cancelled',
  'no_show',
];

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return (
    typeof value === 'string' &&
    (APPOINTMENT_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Returns true when `actor` may move an appointment from `from` to `to`.
 */
export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  actor: Actor,
): boolean {
  const allowedActors = TRANSITIONS[from]?.[to];
  return allowedActors !== undefined && allowedActors.includes(actor);
}

/**
 * All statuses `actor` may move an appointment in `from` into.
 */
export function allowedTransitions(
  from: AppointmentStatus,
  actor: Actor,
): AppointmentStatus[] {
  const row = TRANSITIONS[from];
  return (Object.keys(row) as AppointmentStatus[]).filter((to) =>
    (row[to] ?? []).includes(actor),
  );
}
