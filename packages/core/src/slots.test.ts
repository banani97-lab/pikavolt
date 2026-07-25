import { describe, expect, it } from 'vitest';
import { computeSlots, type BusinessHours } from './slots.js';

/** Open 08:00–17:00 local every day of the week. */
const openAllWeek: BusinessHours[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  opensAt: '08:00',
  closesAt: '17:00',
  isOpen: true,
}));

/** A `now` far in the past so no slot is filtered as "in the past". */
const longAgo = new Date('2020-01-01T00:00:00Z');

describe('computeSlots — basics', () => {
  it('steps duration+buffer from opening and fits slots before closing', () => {
    // Wed 2025-01-15 (EST, UTC-5): 08:00→13:00Z. Starts 08:00, 10:30, 13:00;
    // a 15:30 slot would end 17:30 > close 17:00 so it is not emitted.
    const slots = computeSlots({
      date: '2025-01-15',
      businessHours: openAllWeek,
      now: longAgo,
    });
    expect(slots).toEqual([
      { startsAt: '2025-01-15T13:00:00.000Z', endsAt: '2025-01-15T15:00:00.000Z', available: true },
      { startsAt: '2025-01-15T15:30:00.000Z', endsAt: '2025-01-15T17:30:00.000Z', available: true },
      { startsAt: '2025-01-15T18:00:00.000Z', endsAt: '2025-01-15T20:00:00.000Z', available: true },
    ]);
  });

  it('respects custom duration and buffer', () => {
    const slots = computeSlots({
      date: '2025-01-15',
      businessHours: openAllWeek,
      slotDurationMinutes: 240,
      bufferMinutes: 60,
      now: longAgo,
    });
    // 08:00–12:00, then 13:00–17:00 exactly at close.
    expect(slots.map((s) => [s.startsAt, s.endsAt])).toEqual([
      ['2025-01-15T13:00:00.000Z', '2025-01-15T17:00:00.000Z'],
      ['2025-01-15T18:00:00.000Z', '2025-01-15T22:00:00.000Z'],
    ]);
  });

  it('returns [] on closed days and days without hours', () => {
    const closedSunday: BusinessHours[] = [
      { dayOfWeek: 0, opensAt: '08:00', closesAt: '17:00', isOpen: false },
    ];
    // 2025-01-19 is a Sunday.
    expect(
      computeSlots({ date: '2025-01-19', businessHours: closedSunday, now: longAgo }),
    ).toEqual([]);
    // No entry at all for Monday.
    expect(
      computeSlots({ date: '2025-01-20', businessHours: closedSunday, now: longAgo }),
    ).toEqual([]);
  });

  it('rejects malformed dates and hours', () => {
    expect(() =>
      computeSlots({ date: '01/15/2025', businessHours: openAllWeek, now: longAgo }),
    ).toThrow(RangeError);
    expect(() =>
      computeSlots({
        date: '2025-01-15',
        businessHours: [{ dayOfWeek: 3, opensAt: '8am', closesAt: '17:00', isOpen: true }],
        now: longAgo,
      }),
    ).toThrow(RangeError);
    expect(() =>
      computeSlots({
        date: '2025-01-15',
        businessHours: openAllWeek,
        slotDurationMinutes: 0,
        now: longAgo,
      }),
    ).toThrow(RangeError);
  });
});

describe('computeSlots — past filtering', () => {
  it('omits slots that would start in the past', () => {
    // Tue 2025-07-15 (EDT, UTC-4): starts at 12:00Z, 14:30Z, 17:00Z.
    // now = 15:00Z → only the 17:00Z slot remains.
    const slots = computeSlots({
      date: '2025-07-15',
      businessHours: openAllWeek,
      now: new Date('2025-07-15T15:00:00Z'),
    });
    expect(slots.map((s) => s.startsAt)).toEqual(['2025-07-15T17:00:00.000Z']);
  });

  it('returns [] for a fully past day', () => {
    const slots = computeSlots({
      date: '2025-07-14',
      businessHours: openAllWeek,
      now: new Date('2025-07-15T15:00:00Z'),
    });
    expect(slots).toEqual([]);
  });
});

describe('computeSlots — conflicts', () => {
  it('marks slots overlapping blocked ranges unavailable', () => {
    const slots = computeSlots({
      date: '2025-01-15',
      businessHours: openAllWeek,
      // Blocks local 10:30–12:30 (15:30Z–17:30Z), the second slot exactly.
      blockedRanges: [{ startsAt: '2025-01-15T15:30:00Z', endsAt: '2025-01-15T17:30:00Z' }],
      now: longAgo,
    });
    expect(slots.map((s) => s.available)).toEqual([true, false, true]);
  });

  it('marks slots conflicting with existing appointments unavailable, including buffer', () => {
    const slots = computeSlots({
      date: '2025-01-15',
      businessHours: openAllWeek,
      // Appointment local 12:45–13:15 (17:45Z–18:15Z). With a 30-minute
      // buffer it reaches back to 17:15Z, into the 15:30Z–17:30Z slot, and
      // overlaps the 18:00Z–20:00Z slot directly.
      appointmentRanges: [{ startsAt: '2025-01-15T17:45:00Z', endsAt: '2025-01-15T18:15:00Z' }],
      now: longAgo,
    });
    expect(slots.map((s) => s.available)).toEqual([true, false, false]);
  });

  it('does not flag appointments that respect the buffer', () => {
    const slots = computeSlots({
      date: '2025-01-15',
      businessHours: openAllWeek,
      // Appointment 20:30Z–21:00Z: with a 30-minute buffer it reaches back
      // exactly to 20:00Z, which does not overlap the half-open last slot
      // [18:00Z, 20:00Z). Every slot stays available.
      appointmentRanges: [{ startsAt: '2025-01-15T20:30:00Z', endsAt: '2025-01-15T21:00:00Z' }],
      now: longAgo,
    });
    expect(slots.map((s) => s.available)).toEqual([true, true, true]);
  });
});

describe('computeSlots — DST edges (America/New_York)', () => {
  it('spring forward (2025-03-09): 08:00 local is 12:00Z (EDT)', () => {
    const slots = computeSlots({
      date: '2025-03-09', // Sunday — clocks jump 02:00→03:00
      businessHours: openAllWeek,
      now: longAgo,
    });
    expect(slots[0]).toMatchObject({
      startsAt: '2025-03-09T12:00:00.000Z',
      endsAt: '2025-03-09T14:00:00.000Z',
    });
    // The whole day stays on EDT offsets after the jump.
    expect(slots.map((s) => s.startsAt)).toEqual([
      '2025-03-09T12:00:00.000Z',
      '2025-03-09T14:30:00.000Z',
      '2025-03-09T17:00:00.000Z',
    ]);
  });

  it('fall back (2025-11-02): 08:00 local is 13:00Z (EST)', () => {
    const slots = computeSlots({
      date: '2025-11-02', // Sunday — clocks fall back 02:00→01:00
      businessHours: openAllWeek,
      now: longAgo,
    });
    expect(slots.map((s) => s.startsAt)).toEqual([
      '2025-11-02T13:00:00.000Z',
      '2025-11-02T15:30:00.000Z',
      '2025-11-02T18:00:00.000Z',
    ]);
  });

  it('day before spring forward uses the standard offset', () => {
    const slots = computeSlots({
      date: '2025-03-08', // Saturday, still EST
      businessHours: openAllWeek,
      now: longAgo,
    });
    expect(slots[0]?.startsAt).toBe('2025-03-08T13:00:00.000Z');
  });

  it('honors a non-default timezone', () => {
    const slots = computeSlots({
      date: '2025-01-15',
      businessHours: openAllWeek,
      timezone: 'America/Chicago', // UTC-6 in January
      now: longAgo,
    });
    expect(slots[0]?.startsAt).toBe('2025-01-15T14:00:00.000Z');
  });
});
