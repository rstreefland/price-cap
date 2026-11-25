import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  formatCompactPeriod,
  formatDateRange,
  formatShortDate,
  isDateInHalfOpenRange,
  parsePlainDate,
} from './time';

describe('time helpers', () => {
  it('formats single dates and date ranges cleanly', () => {
    expect(formatShortDate('2026-10-01')).toBe('1 Oct 2026');
    expect(formatDateRange({ startDate: '2026-10-01', endDateInclusive: '2026-12-31' })).toBe(
      '1 Oct to 31 Dec 2026',
    );
    expect(formatDateRange({ startDate: '2021-10-01', endDateInclusive: '2022-03-31' })).toBe(
      '1 Oct 2021 to 31 Mar 2022',
    );
    expect(formatCompactPeriod({ startDate: '2027-01-01', endDateInclusive: '2027-03-31' })).toBe(
      'Jan to Mar 2027',
    );
    expect(formatCompactPeriod({ startDate: '2021-10-01', endDateInclusive: '2022-03-31' })).toBe(
      'Oct 2021 to Mar 2022',
    );
  });

  it('evaluates half-open civil date intervals and day offsets', () => {
    const start = parsePlainDate('2026-10-01');
    const lastDay = parsePlainDate('2026-12-31');
    const nextStart = parsePlainDate('2027-01-01');

    expect(
      isDateInHalfOpenRange({
        date: start,
        startDate: '2026-10-01',
        endDateExclusive: '2027-01-01',
      }),
    ).toBe(true);
    expect(
      isDateInHalfOpenRange({
        date: lastDay,
        startDate: '2026-10-01',
        endDateExclusive: '2027-01-01',
      }),
    ).toBe(true);
    expect(
      isDateInHalfOpenRange({
        date: nextStart,
        startDate: '2026-10-01',
        endDateExclusive: '2027-01-01',
      }),
    ).toBe(false);

    expect(daysUntil({ from: parsePlainDate('2026-11-25'), toIsoDate: '2027-01-01' })).toBe(37);
  });
});
