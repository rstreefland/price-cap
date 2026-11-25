import { decimal, fixed, formatPounds } from '../domain/decimal';
import { formatQuarterTag, type TrendDirection } from '../domain/priceCap';
import type { PeriodStatus } from '../domain/types';

export const CHART_VIEWBOX_WIDTH = 640;
export const CHART_VIEWBOX_HEIGHT = 128;

export interface StepChartInput {
  id: string;
  startDate: string;
  status: PeriodStatus;
  dualFuelAnnualPounds: string;
}

export interface StepChartPoint {
  id: string;
  tag: string;
  status: PeriodStatus;
  valueLabel: string;
  x1: string;
  x2: string;
  midX: string;
  y: string;
  labelY: string;
}

export interface StepChartGeometry {
  connectorPath: string;
  points: StepChartPoint[];
}

export function buildStepChartGeometry(items: ReadonlyArray<StepChartInput>): StepChartGeometry {
  if (items.length === 0) {
    return { connectorPath: '', points: [] };
  }

  const values = items.map((item) => decimal(item.dualFuelAnnualPounds));
  let minVal = values[0];
  let maxVal = values[0];
  for (const val of values) {
    if (val.lt(minVal)) minVal = val;
    if (val.gt(maxVal)) maxVal = val;
  }

  const domainMin = minVal.times('0.9');
  const domainMax = maxVal.times('1.07');
  const domainSpan = domainMax.gt(domainMin) ? domainMax.minus(domainMin) : decimal(1);

  const width = decimal(CHART_VIEWBOX_WIDTH);
  const height = decimal(CHART_VIEWBOX_HEIGHT);
  const padTop = decimal(26);
  const padBottom = decimal(24);
  const plotHeight = height.minus(padTop).minus(padBottom);
  const segmentWidth = width.div(items.length);
  const inset = decimal(6);

  const points: StepChartPoint[] = [];
  const pathSegments: string[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const value = values[index];
    const x1Dec = segmentWidth.times(index).plus(inset);
    const x2Dec = segmentWidth.times(index + 1).minus(inset);
    const midXDec = x1Dec.plus(x2Dec).div(2);
    const ratio = value.minus(domainMin).div(domainSpan);
    const yDec = height.minus(padBottom).minus(ratio.times(plotHeight));
    const labelYDec = yDec.minus(8);

    const x1 = fixed({ value: x1Dec, places: 1 });
    const x2 = fixed({ value: x2Dec, places: 1 });
    const midX = fixed({ value: midXDec, places: 1 });
    const y = fixed({ value: yDec, places: 1 });
    const labelY = fixed({ value: labelYDec, places: 1 });

    pathSegments.push(`${index === 0 ? 'M' : 'L'} ${x1} ${y} L ${x2} ${y}`);
    points.push({
      id: item.id,
      tag: formatQuarterTag(item.startDate),
      status: item.status,
      valueLabel: formatPounds({ value }),
      x1,
      x2,
      midX,
      y,
      labelY,
    });
  }

  return {
    connectorPath: pathSegments.join(' '),
    points,
  };
}

export function renderStepChartSvg(params: {
  items: ReadonlyArray<StepChartInput>;
  nextTrend: TrendDirection;
}): string {
  const geometry = buildStepChartGeometry(params.items);
  const gridLines = [26, 65, 104]
    .map(
      (y) =>
        `<line class="chart-grid-line" x1="0" y1="${y}" x2="${CHART_VIEWBOX_WIDTH}" y2="${y}" />`,
    )
    .join('');

  const segments = geometry.points
    .map((point, index) => {
      const roleClass =
        point.status === 'upcoming'
          ? 'is-upcoming'
          : point.status === 'current'
            ? 'is-current'
            : 'is-past';
      return `<g class="chart-step ${roleClass}" data-chart-step="${index}">
        <line class="chart-step-bar" x1="${point.x1}" y1="${point.y}" x2="${point.x2}" y2="${point.y}" />
        <text class="chart-step-value" x="${point.midX}" y="${point.labelY}" text-anchor="middle">${point.valueLabel}</text>
        <text class="chart-step-tag" x="${point.midX}" y="122" text-anchor="middle">${point.tag}</text>
      </g>`;
    })
    .join('');

  return `<svg class="step-chart" data-chart-svg data-trend="${params.nextTrend}" viewBox="0 0 ${CHART_VIEWBOX_WIDTH} ${CHART_VIEWBOX_HEIGHT}" role="img" aria-label="Quarterly typical dual-fuel price cap step profile">
    ${gridLines}
    <path class="chart-connector" data-chart-connector d="${geometry.connectorPath}" />
    ${segments}
  </svg>`;
}
