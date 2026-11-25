import { Temporal } from 'temporal-polyfill';

export { Temporal };

export const LONDON_TIME_ZONE = 'Europe/London';

export function todayInLondon(): Temporal.PlainDate {
  return Temporal.Now.plainDateISO(LONDON_TIME_ZONE);
}

export function nowIsoInstant(): string {
  return Temporal.Now.instant().toString();
}

export function parsePlainDate(value: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(value);
}

export function formatShortDate(isoDate: string): string {
  return Temporal.PlainDate.from(isoDate).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateRange(params: { startDate: string; endDateInclusive: string }): string {
  const start = Temporal.PlainDate.from(params.startDate);
  const end = Temporal.PlainDate.from(params.endDateInclusive);
  if (start.year === end.year) {
    const startLabel = start.toLocaleString('en-GB', { day: 'numeric', month: 'short' });
    const endLabel = end.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${startLabel} to ${endLabel}`;
  }
  return `${formatShortDate(params.startDate)} to ${formatShortDate(params.endDateInclusive)}`;
}

export function formatCompactPeriod(params: {
  startDate: string;
  endDateInclusive: string;
}): string {
  const start = Temporal.PlainDate.from(params.startDate);
  const end = Temporal.PlainDate.from(params.endDateInclusive);
  const startMonth = start.toLocaleString('en-GB', { month: 'short' });
  const endMonth = end.toLocaleString('en-GB', { month: 'short' });
  if (start.year === end.year) {
    return `${startMonth} to ${endMonth} ${end.year}`;
  }
  return `${startMonth} ${start.year} to ${endMonth} ${end.year}`;
}

export function isDateInHalfOpenRange(params: {
  date: Temporal.PlainDate;
  startDate: string;
  endDateExclusive: string;
}): boolean {
  const start = Temporal.PlainDate.from(params.startDate);
  const endExclusive = Temporal.PlainDate.from(params.endDateExclusive);
  return (
    Temporal.PlainDate.compare(params.date, start) >= 0 &&
    Temporal.PlainDate.compare(params.date, endExclusive) < 0
  );
}

export function daysUntil(params: { from: Temporal.PlainDate; toIsoDate: string }): number {
  const target = Temporal.PlainDate.from(params.toIsoDate);
  return params.from.until(target, { largestUnit: 'day' }).days;
}
