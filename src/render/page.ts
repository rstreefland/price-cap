import {
  formatPence,
  formatPercentChange,
  formatPounds,
  formatSignedPounds,
} from '../domain/decimal';
import {
  buildDashboardSnapshot,
  computeBillDelta,
  formatQuarterTag,
  type TrendDirection,
} from '../domain/priceCap';
import type { Temporal } from '../domain/time';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  REGIONS,
  type CapPeriod,
  type PaymentMethodId,
  type PriceCapDataset,
  type RegionId,
} from '../domain/types';
import { buildStepChartGeometry, renderStepChartSvg } from './chart';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonForScript(value: string): string {
  return value.replace(/</g, '\\u003c');
}

const APP_ICON_SVG = `<svg class="brand-icon" viewBox="0 0 32 32" width="28" height="28" fill="none" aria-hidden="true">
  <rect x="1" y="1" width="30" height="30" rx="6" fill="#171A1D" stroke="#323842" stroke-width="1.5" />
  <rect x="6" y="7" width="20" height="3" rx="1" fill="#F3F4F6" />
  <path d="M7 22H12.5V17.5H19V13.5H25" stroke="#F3F4F6" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" />
  <rect class="brand-icon-accent" x="22" y="12" width="4" height="3" rx="0.75" />
</svg>`;

export interface ClientViewState {
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
  chartPoints: Array<{
    y: string;
    labelY: string;
    valueLabel: string;
  }>;
}

export interface CompactClientPayload {
  views: Record<PaymentMethodId, Record<RegionId, ClientViewState>>;
}

function buildClientView(params: {
  recentPeriods: ReadonlyArray<{ period: CapPeriod; status: 'current' | 'upcoming' | 'past' }>;
  currentPeriod: CapPeriod;
  upcomingPeriod: CapPeriod | null;
  paymentMethod: PaymentMethodId;
  regionId: RegionId;
  regionName: string;
}): ClientViewState {
  const cur = params.currentPeriod.rates[params.paymentMethod][params.regionId];
  const nxt = params.upcomingPeriod
    ? params.upcomingPeriod.rates[params.paymentMethod][params.regionId]
    : null;

  const delta = nxt
    ? computeBillDelta({
        currentPounds: nxt.dualFuelAnnualPounds,
        previousPounds: cur.dualFuelAnnualPounds,
      })
    : null;

  const trend: TrendDirection = delta ? delta.trend : 'flat';
  const deltaFull = delta
    ? `${formatSignedPounds({ value: delta.poundsDifference })} (${
        delta.percentChange ? formatPercentChange({ value: delta.percentChange }) : '0%'
      })`
    : null;

  const geometry = buildStepChartGeometry(
    params.recentPeriods.map((entry) => ({
      id: entry.period.id,
      startDate: entry.period.startDate,
      status: entry.status,
      dualFuelAnnualPounds:
        entry.period.rates[params.paymentMethod][params.regionId].dualFuelAnnualPounds,
    })),
  );

  return {
    regionName: params.regionName,
    curDual: formatPounds({ value: cur.dualFuelAnnualPounds }),
    nxtDual: nxt ? formatPounds({ value: nxt.dualFuelAnnualPounds }) : null,
    deltaFull,
    trend,
    curElecUnit: `${formatPence({ value: cur.electricity.unitRatePence })}`,
    curElecStanding: `${formatPence({ value: cur.electricity.standingChargePence })}`,
    curGasUnit: `${formatPence({ value: cur.gas.unitRatePence })}`,
    curGasStanding: `${formatPence({ value: cur.gas.standingChargePence })}`,
    nxtElecUnit: nxt ? `${formatPence({ value: nxt.electricity.unitRatePence })}/kWh` : null,
    nxtElecStanding: nxt
      ? `${formatPence({ value: nxt.electricity.standingChargePence })}/day`
      : null,
    nxtGasUnit: nxt ? `${formatPence({ value: nxt.gas.unitRatePence })}/kWh` : null,
    nxtGasStanding: nxt ? `${formatPence({ value: nxt.gas.standingChargePence })}/day` : null,
    chartConnector: geometry.connectorPath,
    chartPoints: geometry.points.map((point) => ({
      y: point.y,
      labelY: point.labelY,
      valueLabel: point.valueLabel,
    })),
  };
}

function buildCompactPayload(params: {
  recentPeriods: ReadonlyArray<{ period: CapPeriod; status: 'current' | 'upcoming' | 'past' }>;
  currentPeriod: CapPeriod;
  upcomingPeriod: CapPeriod | null;
}): CompactClientPayload {
  const buildMethodViews = (paymentMethod: PaymentMethodId): Record<RegionId, ClientViewState> => {
    const viewFor = (regionId: RegionId): ClientViewState => {
      const meta = REGIONS.find((region) => region.id === regionId);
      return buildClientView({
        recentPeriods: params.recentPeriods,
        currentPeriod: params.currentPeriod,
        upcomingPeriod: params.upcomingPeriod,
        paymentMethod,
        regionId,
        regionName: meta ? meta.name : regionId,
      });
    };

    return {
      'gb-average': viewFor('gb-average'),
      'north-west': viewFor('north-west'),
      northern: viewFor('northern'),
      yorkshire: viewFor('yorkshire'),
      'northern-scotland': viewFor('northern-scotland'),
      southern: viewFor('southern'),
      'southern-scotland': viewFor('southern-scotland'),
      'north-wales-and-mersey': viewFor('north-wales-and-mersey'),
      london: viewFor('london'),
      'south-east': viewFor('south-east'),
      eastern: viewFor('eastern'),
      'east-midlands': viewFor('east-midlands'),
      midlands: viewFor('midlands'),
      'south-west': viewFor('south-west'),
      'south-wales': viewFor('south-wales'),
    };
  };

  return {
    views: {
      'direct-debit': buildMethodViews('direct-debit'),
      prepayment: buildMethodViews('prepayment'),
      'standard-credit': buildMethodViews('standard-credit'),
    },
  };
}

function formatVatNote(period: CapPeriod): string {
  const elecVat = period.vat.electricityRate === '0' ? '0% elec VAT' : '5% elec VAT';
  const gasVat = period.vat.gasRate === '0' ? '0% gas VAT' : '5% gas VAT';
  return `${elecVat}, ${gasVat}`;
}

export function renderPageHtml(params: {
  dataset: PriceCapDataset;
  referenceDate: Temporal.PlainDate;
}): string {
  const snapshot = buildDashboardSnapshot({
    dataset: params.dataset,
    regionId: 'gb-average',
    paymentMethod: 'direct-debit',
    referenceDate: params.referenceDate,
    historyCount: 6,
  });

  const recentPeriods = snapshot.recentQuarters.map((item) => ({
    period: item.period,
    status: item.status,
  }));

  const payload = buildCompactPayload({
    recentPeriods,
    currentPeriod: snapshot.currentPeriod,
    upcomingPeriod: snapshot.upcomingPeriod,
  });

  const initialTrend: TrendDirection = snapshot.upcomingVsCurrent
    ? snapshot.upcomingVsCurrent.trend
    : 'flat';

  const regionOptions = REGIONS.map(
    (region) => `<option value="${escapeHtml(region.id)}">${escapeHtml(region.name)}</option>`,
  ).join('');

  const paymentOptions = PAYMENT_METHODS.map(
    (method) =>
      `<option value="${escapeHtml(method)}">${escapeHtml(PAYMENT_METHOD_LABELS[method])}</option>`,
  ).join('');

  const deltaText = snapshot.upcomingVsCurrent
    ? `${formatSignedPounds({ value: snapshot.upcomingVsCurrent.poundsDifference })} (${
        snapshot.upcomingVsCurrent.percentChange
          ? formatPercentChange({ value: snapshot.upcomingVsCurrent.percentChange })
          : '0%'
      })`
    : '';

  const daysText =
    snapshot.daysUntilUpcoming !== null
      ? snapshot.daysUntilUpcoming === 1
        ? 'effective tomorrow'
        : `effective in ${snapshot.daysUntilUpcoming} days`
      : '';

  const nextQuarterTag = snapshot.upcomingPeriod
    ? formatQuarterTag(snapshot.upcomingPeriod.startDate)
    : null;

  const upcomingHeroCell =
    snapshot.upcomingPeriod && snapshot.upcomingRates
      ? `<article class="hero-cell hero-cell--next" data-trend-target data-trend="${initialTrend}">
          <p class="kicker">Announced · ${escapeHtml(snapshot.upcomingPeriod.label)}</p>
          <p class="hero-figure hero-figure--next tnum" data-field="nxt-dual">${escapeHtml(formatPounds({ value: snapshot.upcomingRates.dualFuelAnnualPounds }))}</p>
          <p class="hero-meta tnum">
            <span class="trend-text" data-field="delta-full">${escapeHtml(deltaText)}</span>${daysText ? ` · ${escapeHtml(daysText)}` : ''}
          </p>
        </article>`
      : `<article class="hero-cell hero-cell--next" data-trend-target data-trend="flat">
          <p class="kicker">Next price cap</p>
          <p class="hero-figure hero-figure--pending">Awaiting announcement</p>
          <p class="hero-meta">Ofgem announces the next quarterly cap roughly five weeks before it starts.</p>
        </article>`;

  const rateNextLine = (params: { field: string; value: string | null }) =>
    params.value
      ? `<p class="rate-next tnum" data-trend-target data-trend="${initialTrend}">${escapeHtml(nextQuarterTag ?? 'Next')} <span data-field="${params.field}">${escapeHtml(params.value)}</span></p>`
      : `<p class="rate-next rate-next--muted">Current quarter</p>`;

  const stepChartSvg = renderStepChartSvg({
    items: snapshot.recentQuarters.map((item) => ({
      id: item.period.id,
      startDate: item.period.startDate,
      status: item.status,
      dualFuelAnnualPounds: item.rates.dualFuelAnnualPounds,
    })),
    nextTrend: initialTrend,
  });

  const allRegionsRows = REGIONS.filter((region) => region.id !== 'gb-average')
    .map((region) => {
      const cur = snapshot.currentPeriod.rates['direct-debit'][region.id];
      const nxt = snapshot.upcomingPeriod
        ? snapshot.upcomingPeriod.rates['direct-debit'][region.id]
        : null;
      return `<tr>
        <td>${escapeHtml(region.name)}</td>
        <td class="num">${escapeHtml(formatPounds({ value: cur.dualFuelAnnualPounds }))}</td>
        <td class="num">${nxt ? escapeHtml(formatPounds({ value: nxt.dualFuelAnnualPounds })) : 'Pending'}</td>
        <td class="num">${escapeHtml(formatPence({ value: cur.electricity.unitRatePence }))}/kWh</td>
        <td class="num">${escapeHtml(formatPence({ value: cur.electricity.standingChargePence }))}/day</td>
        <td class="num">${escapeHtml(formatPence({ value: cur.gas.unitRatePence }))}/kWh</td>
        <td class="num">${escapeHtml(formatPence({ value: cur.gas.standingChargePence }))}/day</td>
      </tr>`;
    })
    .join('');

  return `<div class="page-frame" data-trend-root data-trend="${initialTrend}">
      <div class="instrument">
        <header class="instrument-header">
          <div class="brand-block">
            <div class="brand-title-row">
              ${APP_ICON_SVG}
              <h1 class="brand-title">Ofgem price cap</h1>
            </div>
            <p class="brand-lead">Current and upcoming Ofgem default tariff rates across Great Britain, parsed directly from Ofgem Annex 9 data. Pick your region and payment method to compare unit rates, standing charges, and typical annual bills.</p>
          </div>
          <div class="controls-bar" role="group" aria-label="Region and payment method filters">
            <div class="control-field">
              <label class="control-label" for="region-select">Region</label>
              <select id="region-select" class="control-select">${regionOptions}</select>
            </div>
            <div class="control-field">
              <label class="control-label" for="payment-select">Payment method</label>
              <select id="payment-select" class="control-select">${paymentOptions}</select>
            </div>
          </div>
        </header>

        <main id="main-content">
          <section class="hero-grid" aria-label="Current and upcoming annual price cap">
            <article class="hero-cell">
              <p class="kicker">Active cap · ${escapeHtml(snapshot.currentPeriod.label)}</p>
              <p class="hero-figure tnum" data-field="cur-dual">${escapeHtml(formatPounds({ value: snapshot.currentRates.dualFuelAnnualPounds }))}</p>
              <p class="hero-meta">Typical annual dual-fuel bill · ${escapeHtml(formatVatNote(snapshot.currentPeriod))}</p>
            </article>
            ${upcomingHeroCell}
          </section>

          <section class="rates-strip" aria-label="Electricity and gas unit rates and standing charges">
            <article class="rate-cell">
              <p class="rate-label">Electricity unit</p>
              <p class="rate-value tnum"><span data-field="cur-elec-unit">${escapeHtml(formatPence({ value: snapshot.currentRates.electricity.unitRatePence }))}</span><span class="rate-unit">/kWh</span></p>
              ${rateNextLine({
                field: 'nxt-elec-unit',
                value: snapshot.upcomingRates
                  ? `${formatPence({ value: snapshot.upcomingRates.electricity.unitRatePence })}/kWh`
                  : null,
              })}
            </article>
            <article class="rate-cell">
              <p class="rate-label">Electricity standing</p>
              <p class="rate-value tnum"><span data-field="cur-elec-standing">${escapeHtml(formatPence({ value: snapshot.currentRates.electricity.standingChargePence }))}</span><span class="rate-unit">/day</span></p>
              ${rateNextLine({
                field: 'nxt-elec-standing',
                value: snapshot.upcomingRates
                  ? `${formatPence({ value: snapshot.upcomingRates.electricity.standingChargePence })}/day`
                  : null,
              })}
            </article>
            <article class="rate-cell">
              <p class="rate-label">Gas unit</p>
              <p class="rate-value tnum"><span data-field="cur-gas-unit">${escapeHtml(formatPence({ value: snapshot.currentRates.gas.unitRatePence }))}</span><span class="rate-unit">/kWh</span></p>
              ${rateNextLine({
                field: 'nxt-gas-unit',
                value: snapshot.upcomingRates
                  ? `${formatPence({ value: snapshot.upcomingRates.gas.unitRatePence })}/kWh`
                  : null,
              })}
            </article>
            <article class="rate-cell">
              <p class="rate-label">Gas standing</p>
              <p class="rate-value tnum"><span data-field="cur-gas-standing">${escapeHtml(formatPence({ value: snapshot.currentRates.gas.standingChargePence }))}</span><span class="rate-unit">/day</span></p>
              ${rateNextLine({
                field: 'nxt-gas-standing',
                value: snapshot.upcomingRates
                  ? `${formatPence({ value: snapshot.upcomingRates.gas.standingChargePence })}/day`
                  : null,
              })}
            </article>
          </section>

          <section class="chart-panel" aria-label="Quarterly step profile">
            <div class="chart-header">
              <h2 class="chart-heading">Quarterly step profile</h2>
              <p class="chart-region" data-field="region-name">Great Britain average</p>
            </div>
            ${stepChartSvg}
          </section>

          <details class="regions-disclosure">
            <summary class="regions-summary">All 14 Great Britain regions (Direct Debit)</summary>
            <div class="table-scroll">
              <table class="regions-table tnum">
                <thead>
                  <tr>
                    <th scope="col">Region</th>
                    <th scope="col" class="num">Current</th>
                    <th scope="col" class="num">Next</th>
                    <th scope="col" class="num">Elec unit</th>
                    <th scope="col" class="num">Elec standing</th>
                    <th scope="col" class="num">Gas unit</th>
                    <th scope="col" class="num">Gas standing</th>
                  </tr>
                </thead>
                <tbody>${allRegionsRows}</tbody>
              </table>
            </div>
          </details>
        </main>

        <footer class="instrument-footer">
          <p class="footer-credit">Created by Rhys Streefland</p>
          <p class="footer-disclaimer">Data is sourced from Ofgem and provided for information only; use at your own risk.</p>
        </footer>
      </div>

      <script type="application/json" id="price-cap-payload">${escapeJsonForScript(JSON.stringify(payload))}</script>
    </div>`;
}
