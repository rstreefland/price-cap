import { decimal, percentageChange, type DecimalValue } from './decimal';
import { isDateInHalfOpenRange, Temporal } from './time';
import type {
  CapPeriod,
  PaymentMethodId,
  PeriodStatus,
  PriceCapDataset,
  RegionId,
  RegionalRates,
} from './types';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface PeriodDelta {
  poundsDifference: DecimalValue;
  percentChange: DecimalValue | null;
  trend: TrendDirection;
}

export interface QuarterlySummaryItem {
  period: CapPeriod;
  status: PeriodStatus;
  rates: RegionalRates;
  deltaFromPrevious: PeriodDelta | null;
}

export interface DashboardSnapshot {
  currentPeriod: CapPeriod;
  upcomingPeriod: CapPeriod | null;
  previousPeriod: CapPeriod | null;
  selectedRegion: RegionId;
  selectedPaymentMethod: PaymentMethodId;
  currentRates: RegionalRates;
  upcomingRates: RegionalRates | null;
  currentVsPrevious: PeriodDelta | null;
  upcomingVsCurrent: PeriodDelta | null;
  recentQuarters: QuarterlySummaryItem[];
}

export function classifyTrend(difference: DecimalValue): TrendDirection {
  if (difference.gt(0)) return 'up';
  if (difference.lt(0)) return 'down';
  return 'flat';
}

export function classifyPeriodStatus(params: {
  period: CapPeriod;
  referenceDate: Temporal.PlainDate;
}): PeriodStatus {
  if (
    isDateInHalfOpenRange({
      date: params.referenceDate,
      startDate: params.period.startDate,
      endDateExclusive: params.period.endDateExclusive,
    })
  ) {
    return 'current';
  }
  const start = Temporal.PlainDate.from(params.period.startDate);
  return Temporal.PlainDate.compare(start, params.referenceDate) > 0 ? 'upcoming' : 'past';
}

export function computeBillDelta(params: {
  currentPounds: string;
  previousPounds: string;
}): PeriodDelta {
  const current = decimal(params.currentPounds);
  const previous = decimal(params.previousPounds);
  const poundsDifference = current.minus(previous);
  return {
    poundsDifference,
    percentChange: percentageChange({ current, previous }),
    trend: classifyTrend(poundsDifference),
  };
}

export function formatQuarterTag(startDate: string): string {
  const date = Temporal.PlainDate.from(startDate);
  const quarter = date.month <= 3 ? 1 : date.month <= 6 ? 2 : date.month <= 9 ? 3 : 4;
  const shortYear = String(date.year).slice(-2);
  return `Q${quarter} ${shortYear}`;
}

export function buildDashboardSnapshot(params: {
  dataset: PriceCapDataset;
  regionId: RegionId;
  paymentMethod: PaymentMethodId;
  referenceDate: Temporal.PlainDate;
  historyCount?: number;
}): DashboardSnapshot {
  const periods = params.dataset.periods;
  if (periods.length === 0) {
    throw new Error('Cannot build snapshot from an empty price cap dataset');
  }

  let currentIndex = periods.findIndex(
    (period) => classifyPeriodStatus({ period, referenceDate: params.referenceDate }) === 'current',
  );

  if (currentIndex === -1) {
    const pastIndices = periods
      .map((period, index) => ({
        index,
        status: classifyPeriodStatus({ period, referenceDate: params.referenceDate }),
      }))
      .filter((entry) => entry.status === 'past');

    currentIndex = pastIndices.length > 0 ? pastIndices[pastIndices.length - 1].index : 0;
  }

  const currentPeriod = periods[currentIndex];
  const previousPeriod = currentIndex > 0 ? periods[currentIndex - 1] : null;
  const nextCandidate = currentIndex + 1 < periods.length ? periods[currentIndex + 1] : null;
  const upcomingPeriod =
    nextCandidate &&
    classifyPeriodStatus({ period: nextCandidate, referenceDate: params.referenceDate }) ===
      'upcoming'
      ? nextCandidate
      : null;

  const getRates = (period: CapPeriod): RegionalRates =>
    period.rates[params.paymentMethod][params.regionId];

  const currentRates = getRates(currentPeriod);
  const upcomingRates = upcomingPeriod ? getRates(upcomingPeriod) : null;
  const previousRates = previousPeriod ? getRates(previousPeriod) : null;

  const currentVsPrevious = previousRates
    ? computeBillDelta({
        currentPounds: currentRates.dualFuelAnnualPounds,
        previousPounds: previousRates.dualFuelAnnualPounds,
      })
    : null;

  const upcomingVsCurrent = upcomingRates
    ? computeBillDelta({
        currentPounds: upcomingRates.dualFuelAnnualPounds,
        previousPounds: currentRates.dualFuelAnnualPounds,
      })
    : null;

  const maxHistory = params.historyCount ?? 6;
  const endSlice = upcomingPeriod ? currentIndex + 2 : currentIndex + 1;
  const startSlice = endSlice > maxHistory ? endSlice - maxHistory : 0;
  const slice = periods.slice(startSlice, endSlice);

  const recentQuarters: QuarterlySummaryItem[] = slice.map((period, offset) => {
    const absoluteIndex = startSlice + offset;
    const rates = getRates(period);
    const prior = absoluteIndex > 0 ? getRates(periods[absoluteIndex - 1]) : null;
    return {
      period,
      status: classifyPeriodStatus({ period, referenceDate: params.referenceDate }),
      rates,
      deltaFromPrevious: prior
        ? computeBillDelta({
            currentPounds: rates.dualFuelAnnualPounds,
            previousPounds: prior.dualFuelAnnualPounds,
          })
        : null,
    };
  });

  return {
    currentPeriod,
    upcomingPeriod,
    previousPeriod,
    selectedRegion: params.regionId,
    selectedPaymentMethod: params.paymentMethod,
    currentRates,
    upcomingRates,
    currentVsPrevious,
    upcomingVsCurrent,
    recentQuarters,
  };
}
