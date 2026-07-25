import { describe, expect, it } from 'vitest';
import {
  ACTORS,
  APPOINTMENT_STATUSES,
  TRANSITIONS,
  allowedTransitions,
  canTransition,
  isAppointmentStatus,
  type Actor,
  type AppointmentStatus,
} from './stateMachine.js';

describe('APPOINTMENT_STATUSES', () => {
  it('contains exactly the eight frozen statuses', () => {
    expect(APPOINTMENT_STATUSES).toEqual([
      'requested',
      'confirmed',
      'en_route',
      'in_progress',
      'completed',
      'closed',
      'cancelled',
      'no_show',
    ]);
  });
});

describe('canTransition', () => {
  const allowed: Array<[AppointmentStatus, AppointmentStatus, Actor]> = [
    ['requested', 'confirmed', 'owner'],
    ['requested', 'cancelled', 'customer'],
    ['requested', 'cancelled', 'owner'],
    ['confirmed', 'en_route', 'owner'],
    ['confirmed', 'cancelled', 'customer'],
    ['confirmed', 'cancelled', 'owner'],
    ['en_route', 'in_progress', 'owner'],
    ['en_route', 'cancelled', 'owner'],
    ['en_route', 'no_show', 'owner'],
    ['in_progress', 'completed', 'owner'],
    ['in_progress', 'no_show', 'owner'],
    ['in_progress', 'cancelled', 'owner'],
    ['completed', 'closed', 'system'],
  ];

  it.each(allowed)('allows %s → %s by %s', (from, to, actor) => {
    expect(canTransition(from, to, actor)).toBe(true);
  });

  it('allows nothing else (exhaustive over the full cube)', () => {
    const allowedSet = new Set(allowed.map(([f, t, a]) => `${f}|${t}|${a}`));
    for (const from of APPOINTMENT_STATUSES) {
      for (const to of APPOINTMENT_STATUSES) {
        for (const actor of ACTORS) {
          expect(canTransition(from, to, actor)).toBe(
            allowedSet.has(`${from}|${to}|${actor}`),
          );
        }
      }
    }
  });

  it('rejects the wrong actor for an otherwise-valid edge', () => {
    expect(canTransition('requested', 'confirmed', 'customer')).toBe(false);
    expect(canTransition('completed', 'closed', 'owner')).toBe(false);
    expect(canTransition('en_route', 'cancelled', 'customer')).toBe(false);
  });

  it('rejects transitions out of terminal states', () => {
    for (const from of ['closed', 'cancelled', 'no_show'] as const) {
      for (const to of APPOINTMENT_STATUSES) {
        for (const actor of ACTORS) {
          expect(canTransition(from, to, actor)).toBe(false);
        }
      }
    }
  });

  it('rejects self-transitions', () => {
    for (const status of APPOINTMENT_STATUSES) {
      for (const actor of ACTORS) {
        expect(canTransition(status, status, actor)).toBe(false);
      }
    }
  });
});

describe('allowedTransitions', () => {
  it('lists owner options from requested', () => {
    expect(allowedTransitions('requested', 'owner').sort()).toEqual([
      'cancelled',
      'confirmed',
    ]);
  });

  it('lists customer options from confirmed', () => {
    expect(allowedTransitions('confirmed', 'customer')).toEqual(['cancelled']);
  });

  it('is empty for terminal statuses', () => {
    expect(allowedTransitions('closed', 'owner')).toEqual([]);
    expect(allowedTransitions('cancelled', 'system')).toEqual([]);
  });
});

describe('TRANSITIONS table', () => {
  it('has a row for every status', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...APPOINTMENT_STATUSES].sort());
  });
});

describe('isAppointmentStatus', () => {
  it('accepts valid statuses and rejects everything else', () => {
    expect(isAppointmentStatus('en_route')).toBe(true);
    expect(isAppointmentStatus('EN_ROUTE')).toBe(false);
    expect(isAppointmentStatus('pending')).toBe(false);
    expect(isAppointmentStatus(42)).toBe(false);
    expect(isAppointmentStatus(null)).toBe(false);
  });
});
