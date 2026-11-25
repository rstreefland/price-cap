import { describe, expect, it } from 'vitest';
import { buildStepChartGeometry, renderStepChartSvg } from './chart';

describe('step chart renderer', () => {
  it('returns empty geometry for empty inputs', () => {
    expect(buildStepChartGeometry([])).toEqual({ connectorPath: '', points: [] });
  });

  it('builds deterministic decimal geometry and SVG markup with trend attribute', () => {
    const items = [
      {
        id: '2026-07',
        startDate: '2026-07-01',
        status: 'past' as const,
        dualFuelAnnualPounds: '1663',
      },
      {
        id: '2026-10',
        startDate: '2026-10-01',
        status: 'current' as const,
        dualFuelAnnualPounds: '1723',
      },
      {
        id: '2027-01',
        startDate: '2027-01-01',
        status: 'upcoming' as const,
        dualFuelAnnualPounds: '2166',
      },
    ];

    const geometry = buildStepChartGeometry(items);
    expect(geometry.points.map((point) => point.tag)).toEqual(['Q3 26', 'Q4 26', 'Q1 27']);
    expect(geometry.points.map((point) => point.valueLabel)).toEqual([
      '£1,663',
      '£1,723',
      '£2,166',
    ]);
    expect(geometry.connectorPath.startsWith('M ')).toBe(true);

    const svgUp = renderStepChartSvg({ items, nextTrend: 'up' });
    expect(svgUp).toContain('data-trend="up"');
    expect(svgUp).toContain('is-upcoming');
    expect(svgUp).toContain('£2,166');

    const svgDown = renderStepChartSvg({ items, nextTrend: 'down' });
    expect(svgDown).toContain('data-trend="down"');
  });
});
