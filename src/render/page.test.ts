import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePriceCapDataset } from '../api/schema';
import { initPriceCapControls } from '../client/enhance';
import { parsePlainDate } from '../domain/time';
import { renderPageHtml } from './page';

function loadDataset() {
  const raw = JSON.parse(readFileSync(resolve('data/price-cap.json'), 'utf8'));
  return parsePriceCapDataset(raw);
}

describe('static page renderer and progressive enhancement', () => {
  it('renders Ofgem price cap Design 3 markup with red up trend, footer, and interactive controls', () => {
    const dataset = loadDataset();
    const html = renderPageHtml({
      dataset,
      referenceDate: parsePlainDate('2026-11-25'),
    });

    document.body.innerHTML = html;

    expect(document.querySelector('h1')?.textContent).toBe('Ofgem price cap');
    expect(document.querySelector('.brand-icon')).not.toBeNull();
    expect(document.querySelector('.brand-lead')?.textContent).toContain('Ofgem');
    expect(document.querySelector('.footer-credit')?.textContent).toBe(
      'Created by Rhys Streefland',
    );
    expect(document.querySelector('.footer-disclaimer')?.textContent).toContain(
      'use at your own risk',
    );

    expect(document.querySelector('[data-trend-root]')?.getAttribute('data-trend')).toBe('up');
    expect(document.querySelector('[data-field="cur-dual"]')?.textContent).toBe('£1,723');
    expect(document.querySelector('[data-field="nxt-dual"]')?.textContent).toBe('£2,166');
    expect(document.querySelector('[data-field="cur-elec-unit"]')?.textContent).toBe('26.32p');
    expect(document.querySelector('[data-field="cur-gas-unit"]')?.textContent).toBe('7.97p');

    initPriceCapControls(document);

    const regionSelect = document.getElementById('region-select');
    const paymentSelect = document.getElementById('payment-select');
    if (
      !(regionSelect instanceof HTMLSelectElement) ||
      !(paymentSelect instanceof HTMLSelectElement)
    ) {
      throw new Error('Expected select controls');
    }

    regionSelect.value = 'london';
    regionSelect.dispatchEvent(new Event('change'));
    expect(document.querySelector('[data-field="region-name"]')?.textContent).toBe('London');
    expect(document.querySelector('[data-field="cur-elec-standing"]')?.textContent).toBe('42.92p');
    expect(document.querySelector('[data-field="cur-dual"]')?.textContent).toBe('£1,706');
    expect(document.querySelector('[data-chart-step="5"] .chart-step-value')?.textContent).toBe(
      '£2,152',
    );

    paymentSelect.value = 'standard-credit';
    paymentSelect.dispatchEvent(new Event('change'));
    expect(document.querySelector('[data-field="cur-dual"]')?.textContent).not.toBe('£1,706');
  });

  it('sets green down trend when the next quarter is cheaper than the current quarter', () => {
    const dataset = loadDataset();
    const html = renderPageHtml({
      dataset,
      referenceDate: parsePlainDate('2026-03-01'),
    });

    document.body.innerHTML = html;
    expect(document.querySelector('[data-trend-root]')?.getAttribute('data-trend')).toBe('down');
    expect(document.querySelector('[data-chart-svg]')?.getAttribute('data-trend')).toBe('down');
    expect(document.querySelector('[data-field="cur-dual"]')?.textContent).toBe('£1,758');
    expect(document.querySelector('[data-field="nxt-dual"]')?.textContent).toBe('£1,641');
  });

  it('renders pending state when no upcoming period is announced yet', () => {
    const dataset = loadDataset();
    const html = renderPageHtml({
      dataset,
      referenceDate: parsePlainDate('2027-02-10'),
    });

    document.body.innerHTML = html;
    expect(document.querySelector('[data-field="cur-dual"]')?.textContent).toBe('£2,166');
    expect(document.querySelector('[data-field="nxt-dual"]')).toBeNull();
    expect(document.querySelector('[data-trend-root]')?.getAttribute('data-trend')).toBe('flat');
  });

  it('ignores missing DOM controls or malformed payloads cleanly', () => {
    document.body.innerHTML = '<div>Empty</div>';
    expect(() => initPriceCapControls(document)).not.toThrow();

    document.body.innerHTML =
      '<select id="region-select"></select><select id="payment-select"></select><script id="price-cap-payload" type="application/json">{not-json</script>';
    expect(() => initPriceCapControls(document)).not.toThrow();

    document.body.innerHTML =
      '<select id="region-select"></select><select id="payment-select"></select><script id="price-cap-payload" type="application/json">{}</script>';
    expect(() => initPriceCapControls(document)).not.toThrow();
  });
});
