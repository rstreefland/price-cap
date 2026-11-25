import type { TrendDirection } from '../domain/priceCap';
import { PAYMENT_METHODS, REGIONS } from '../domain/types';

interface DecodedChartPoint {
  y: string;
  labelY: string;
  valueLabel: string;
}

interface DecodedView {
  trend: TrendDirection;
  curDual: string;
  nxtDual: string | null;
  deltaFull: string | null;
  curElecUnit: string;
  curElecStanding: string;
  curGasUnit: string;
  curGasStanding: string;
  nxtElecUnit: string | null;
  nxtElecStanding: string | null;
  nxtGasUnit: string | null;
  nxtGasStanding: string | null;
  chartPoints: DecodedChartPoint[];
}

function decodeTrend(code: unknown): TrendDirection | null {
  if (code === 'u') return 'up';
  if (code === 'd') return 'down';
  if (code === 'f') return 'flat';
  return null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function decodeChartPoints(raw: unknown): DecodedChartPoint[] | null {
  if (!Array.isArray(raw)) return null;
  const points: DecodedChartPoint[] = [];
  for (const item of raw) {
    if (
      !Array.isArray(item) ||
      item.length !== 3 ||
      typeof item[0] !== 'string' ||
      typeof item[1] !== 'string' ||
      typeof item[2] !== 'string'
    ) {
      return null;
    }
    points.push({ y: item[0], labelY: item[1], valueLabel: item[2] });
  }
  return points;
}

function decodeView(raw: unknown): DecodedView | null {
  if (!Array.isArray(raw) || raw.length !== 13) return null;
  const trend = decodeTrend(raw[0]);
  if (!trend) return null;
  if (
    typeof raw[1] !== 'string' ||
    !isNullableString(raw[2]) ||
    !isNullableString(raw[3]) ||
    typeof raw[4] !== 'string' ||
    typeof raw[5] !== 'string' ||
    typeof raw[6] !== 'string' ||
    typeof raw[7] !== 'string' ||
    !isNullableString(raw[8]) ||
    !isNullableString(raw[9]) ||
    !isNullableString(raw[10]) ||
    !isNullableString(raw[11])
  ) {
    return null;
  }
  const chartPoints = decodeChartPoints(raw[12]);
  if (!chartPoints) return null;

  return {
    trend,
    curDual: raw[1],
    nxtDual: raw[2],
    deltaFull: raw[3],
    curElecUnit: raw[4],
    curElecStanding: raw[5],
    curGasUnit: raw[6],
    curGasStanding: raw[7],
    nxtElecUnit: raw[8],
    nxtElecStanding: raw[9],
    nxtGasUnit: raw[10],
    nxtGasStanding: raw[11],
    chartPoints,
  };
}

function parseMatrixPayload(raw: unknown): DecodedView[][] | null {
  if (!Array.isArray(raw) || raw.length !== PAYMENT_METHODS.length) return null;
  const matrix: DecodedView[][] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== REGIONS.length) return null;
    const views: DecodedView[] = [];
    for (const cell of row) {
      const decoded = decodeView(cell);
      if (!decoded) return null;
      views.push(decoded);
    }
    matrix.push(views);
  }
  return matrix;
}

function civilDateToEpochDay(isoDate: string): bigint | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  let year = BigInt(match[1]);
  const month = BigInt(match[2]);
  const day = BigInt(match[3]);
  if (month <= 2n) year -= 1n;
  const era = year >= 0n ? year / 400n : (year - 399n) / 400n;
  const yearOfEra = year - era * 400n;
  const monthOffset = month > 2n ? month - 3n : month + 9n;
  const dayOfYear = (153n * monthOffset + 2n) / 5n + day - 1n;
  const dayOfEra = yearOfEra * 365n + yearOfEra / 4n - yearOfEra / 100n + dayOfYear;
  return era * 146097n + dayOfEra - 719468n;
}

export function todayIsoInLondon(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

export function daysBetweenIsoDates(params: {
  fromIsoDate: string;
  toIsoDate: string;
}): number | null {
  const fromDay = civilDateToEpochDay(params.fromIsoDate);
  const toDay = civilDateToEpochDay(params.toIsoDate);
  if (fromDay === null || toDay === null) return null;
  return Number(toDay - fromDay);
}

export function formatCountdownSuffix(days: number): string | null {
  if (days <= 0) return null;
  if (days === 1) return ' · effective tomorrow';
  return ` · effective in ${days} days`;
}

function setFieldText(root: ParentNode, field: string, value: string | null): void {
  if (value === null) return;
  const el = root.querySelector(`[data-field="${field}"]`);
  if (el) el.textContent = value;
}

export function initCountdown(params: { root?: Document; todayIsoDate?: string } = {}): void {
  const root = params.root ?? document;
  const target = root.querySelector('[data-upcoming-start]');
  if (!target) return;
  const startDate = target.getAttribute('data-upcoming-start');
  if (!startDate) return;
  const fromIsoDate = params.todayIsoDate ?? todayIsoInLondon();
  const days = daysBetweenIsoDates({ fromIsoDate, toIsoDate: startDate });
  if (days === null) return;
  const suffix = formatCountdownSuffix(days);
  if (suffix) {
    target.textContent = suffix;
  }
}

export function initPriceCapControls(root: Document = document): void {
  initCountdown({ root });

  const payloadEl = root.getElementById('price-cap-payload');
  const regionSelect = root.getElementById('region-select');
  const paymentSelect = root.getElementById('payment-select');

  if (
    !payloadEl ||
    !payloadEl.textContent ||
    !(regionSelect instanceof HTMLSelectElement) ||
    !(paymentSelect instanceof HTMLSelectElement)
  ) {
    return;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(payloadEl.textContent);
  } catch {
    return;
  }

  const matrix = parseMatrixPayload(parsedJson);
  if (!matrix) return;

  const updateView = () => {
    const regionIndex = REGIONS.findIndex((region) => region.id === regionSelect.value);
    const paymentIndex = PAYMENT_METHODS.findIndex((method) => method === paymentSelect.value);
    const safeRegionIndex = regionIndex >= 0 ? regionIndex : 0;
    const safePaymentIndex = paymentIndex >= 0 ? paymentIndex : 0;

    const view = matrix[safePaymentIndex][safeRegionIndex];
    const regionMeta = REGIONS[safeRegionIndex];

    setFieldText(root, 'region-name', regionMeta.name);
    setFieldText(root, 'cur-dual', view.curDual);
    setFieldText(root, 'nxt-dual', view.nxtDual);
    setFieldText(root, 'delta-full', view.deltaFull);
    setFieldText(root, 'cur-elec-unit', view.curElecUnit);
    setFieldText(root, 'cur-elec-standing', view.curElecStanding);
    setFieldText(root, 'cur-gas-unit', view.curGasUnit);
    setFieldText(root, 'cur-gas-standing', view.curGasStanding);
    setFieldText(root, 'nxt-elec-unit', view.nxtElecUnit);
    setFieldText(root, 'nxt-elec-standing', view.nxtElecStanding);
    setFieldText(root, 'nxt-gas-unit', view.nxtGasUnit);
    setFieldText(root, 'nxt-gas-standing', view.nxtGasStanding);

    root
      .querySelectorAll('[data-trend-root], [data-trend-target], [data-chart-svg]')
      .forEach((node) => {
        node.setAttribute('data-trend', view.trend);
      });

    const pathSegments: string[] = [];
    view.chartPoints.forEach((point, index) => {
      const group = root.querySelector(`[data-chart-step="${index}"]`);
      if (!group) return;
      const bar = group.querySelector('.chart-step-bar');
      const valueText = group.querySelector('.chart-step-value');
      if (bar) {
        const x1 = bar.getAttribute('x1');
        const x2 = bar.getAttribute('x2');
        bar.setAttribute('y1', point.y);
        bar.setAttribute('y2', point.y);
        if (x1 && x2) {
          pathSegments.push(`${index === 0 ? 'M' : 'L'} ${x1} ${point.y} L ${x2} ${point.y}`);
        }
      }
      if (valueText) {
        valueText.setAttribute('y', point.labelY);
        valueText.textContent = point.valueLabel;
      }
    });

    const connector = root.querySelector('[data-chart-connector]');
    if (connector && pathSegments.length > 0) {
      connector.setAttribute('d', pathSegments.join(' '));
    }
  };

  regionSelect.addEventListener('change', updateView);
  paymentSelect.addEventListener('change', updateView);
}

if (typeof document !== 'undefined') {
  initPriceCapControls(document);
}
