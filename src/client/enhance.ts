import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import type { TrendDirection } from '../domain/priceCap';
import { PAYMENT_METHODS, REGIONS, type PaymentMethodId, type RegionId } from '../domain/types';

interface ClientChartPoint {
  y: string;
  labelY: string;
  valueLabel: string;
}

interface ClientViewEntry {
  regionName: string;
  curDual: string;
  nxtDual: string | null;
  deltaFull: string | null;
  trend: TrendDirection;
  curElecUnit: string;
  curElecStanding: string;
  curGasUnit: string;
  curGasStanding: string;
  nxtElecUnit: string | null;
  nxtElecStanding: string | null;
  nxtGasUnit: string | null;
  nxtGasStanding: string | null;
  chartConnector: string;
  chartPoints: ClientChartPoint[];
}

interface ClientPayload {
  views: Record<string, Record<string, ClientViewEntry>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTrend(value: unknown): value is TrendDirection {
  return value === 'up' || value === 'down' || value === 'flat';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isChartPoint(value: unknown): value is ClientChartPoint {
  return (
    isRecord(value) &&
    typeof value.y === 'string' &&
    typeof value.labelY === 'string' &&
    typeof value.valueLabel === 'string'
  );
}

function isClientView(value: unknown): value is ClientViewEntry {
  return (
    isRecord(value) &&
    typeof value.regionName === 'string' &&
    typeof value.curDual === 'string' &&
    isNullableString(value.nxtDual) &&
    isNullableString(value.deltaFull) &&
    isTrend(value.trend) &&
    typeof value.curElecUnit === 'string' &&
    typeof value.curElecStanding === 'string' &&
    typeof value.curGasUnit === 'string' &&
    typeof value.curGasStanding === 'string' &&
    isNullableString(value.nxtElecUnit) &&
    isNullableString(value.nxtElecStanding) &&
    isNullableString(value.nxtGasUnit) &&
    isNullableString(value.nxtGasStanding) &&
    typeof value.chartConnector === 'string' &&
    Array.isArray(value.chartPoints) &&
    value.chartPoints.every(isChartPoint)
  );
}

function parseClientPayload(raw: unknown): ClientPayload | null {
  if (!isRecord(raw) || !isRecord(raw.views)) return null;
  const views: Record<string, Record<string, ClientViewEntry>> = {};
  for (const [methodKey, regionMap] of Object.entries(raw.views)) {
    if (!isRecord(regionMap)) return null;
    const parsedRegions: Record<string, ClientViewEntry> = {};
    for (const [regionKey, entry] of Object.entries(regionMap)) {
      if (!isClientView(entry)) return null;
      parsedRegions[regionKey] = entry;
    }
    views[methodKey] = parsedRegions;
  }
  return { views };
}

function isRegionId(value: string): value is RegionId {
  return REGIONS.some((region) => region.id === value);
}

function isPaymentMethodId(value: string): value is PaymentMethodId {
  return PAYMENT_METHODS.some((method) => method === value);
}

function setFieldText(root: ParentNode, field: string, value: string | null): void {
  if (value === null) return;
  const el = root.querySelector(`[data-field="${field}"]`);
  if (el) el.textContent = value;
}

export function initPriceCapControls(root: Document = document): void {
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

  const payload = parseClientPayload(parsedJson);
  if (!payload) return;

  const updateView = () => {
    const region = isRegionId(regionSelect.value) ? regionSelect.value : 'gb-average';
    const payment = isPaymentMethodId(paymentSelect.value) ? paymentSelect.value : 'direct-debit';
    const view = payload.views[payment]?.[region];
    if (!view) return;

    setFieldText(root, 'region-name', view.regionName);
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

    const connector = root.querySelector('[data-chart-connector]');
    if (connector) {
      connector.setAttribute('d', view.chartConnector);
    }

    view.chartPoints.forEach((point, index) => {
      const group = root.querySelector(`[data-chart-step="${index}"]`);
      if (!group) return;
      const bar = group.querySelector('.chart-step-bar');
      const valueText = group.querySelector('.chart-step-value');
      if (bar) {
        bar.setAttribute('y1', point.y);
        bar.setAttribute('y2', point.y);
      }
      if (valueText) {
        valueText.setAttribute('y', point.labelY);
        valueText.textContent = point.valueLabel;
      }
    });
  };

  regionSelect.addEventListener('change', updateView);
  paymentSelect.addEventListener('change', updateView);
}

if (typeof document !== 'undefined') {
  initPriceCapControls(document);
}
