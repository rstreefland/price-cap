import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePriceCapDataset } from '../api/schema';
import { decimal, formatPounds, formatSignedPounds } from './decimal';
import {
  buildDashboardSnapshot,
  classifyPeriodStatus,
  classifyTrend,
  formatQuarterTag,
} from './priceCap';
import { parsePlainDate } from './time';

function loadRealDataset() {
  const raw = JSON.parse(readFileSync(resolve('data/price-cap.json'), 'utf8'));
  return parsePriceCapDataset(raw);
}

describe('priceCap domain snapshot', () => {
  it('classifies trends and formats quarter tags', () => {
    expect(classifyTrend(decimal('12.5'))).toBe('up');
    expect(classifyTrend(decimal('-0.01'))).toBe('down');
    expect(classifyTrend(decimal('0'))).toBe('flat');

    expect(formatQuarterTag('2026-01-01')).toBe('Q1 26');
    expect(formatQuarterTag('2026-04-01')).toBe('Q2 26');
    expect(formatQuarterTag('2026-07-01')).toBe('Q3 26');
    expect(formatQuarterTag('2026-10-01')).toBe('Q4 26');
  });

  it('selects current and upcoming periods with upward trend on 25 Nov 2026', () => {
    const dataset = loadRealDataset();
    const snapshot = buildDashboardSnapshot({
      dataset,
      regionId: 'gb-average',
      paymentMethod: 'direct-debit',
      referenceDate: parsePlainDate('2026-11-25'),
      historyCount: 6,
    });

    expect(snapshot.currentPeriod.id).toBe('2026-10');
    expect(snapshot.upcomingPeriod?.id).toBe('2027-01');
    expect(snapshot.daysUntilUpcoming).toBe(37);
    expect(snapshot.upcomingVsCurrent?.trend).toBe('up');
    expect(formatPounds({ value: snapshot.currentRates.dualFuelAnnualPounds })).toBe('£1,723');
    expect(formatPounds({ value: snapshot.upcomingRates?.dualFuelAnnualPounds ?? '0' })).toBe(
      '£2,166',
    );
    expect(formatSignedPounds({ value: snapshot.upcomingVsCurrent?.poundsDifference ?? '0' })).toBe(
      '+£443',
    );
    expect(snapshot.recentQuarters.length).toBe(6);
  });

  it('marks upcoming period trend as down when next quarter is cheaper', () => {
    const dataset = loadRealDataset();
    const snapshot = buildDashboardSnapshot({
      dataset,
      regionId: 'gb-average',
      paymentMethod: 'direct-debit',
      referenceDate: parsePlainDate('2026-03-01'),
    });

    expect(snapshot.currentPeriod.id).toBe('2026-01');
    expect(snapshot.upcomingPeriod?.id).toBe('2026-04');
    expect(snapshot.upcomingVsCurrent?.trend).toBe('down');
  });

  it('handles dates after the latest published period by showing the latest period as current', () => {
    const dataset = loadRealDataset();
    const snapshot = buildDashboardSnapshot({
      dataset,
      regionId: 'london',
      paymentMethod: 'prepayment',
      referenceDate: parsePlainDate('2027-06-01'),
    });

    expect(snapshot.currentPeriod.id).toBe('2027-01');
    expect(snapshot.upcomingPeriod).toBeNull();
    expect(
      classifyPeriodStatus({
        period: snapshot.currentPeriod,
        referenceDate: parsePlainDate('2027-06-01'),
      }),
    ).toBe('past');
  });
});
