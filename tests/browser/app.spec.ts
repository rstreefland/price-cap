import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

describe('production static build', () => {
  it('renders complete Design 3 content, chart, icon, and footer with JavaScript disabled', async () => {
    const result = await commands.productionPage({ mode: 'static' });
    expect(result.status).toBe(200);
    expect(result.title).toBe('Ofgem price cap');
    expect(result.headingVisible).toBe(true);
    expect(result.creditVisible).toBe(true);
    expect(result.disclaimerVisible).toBe(true);
    expect(result.chartVisible).toBe(true);
    expect(result.faviconStatus).toBe(200);
    expect(result.currentDual).toMatch(/^£[\d,]+$/);
    expect(result.nextDual).toMatch(/^£[\d,]+$/);
    expect(result.unexpectedRequests).toEqual([]);
  });

  it('enforces strict production CSP and updates rates and chart progressively', async () => {
    const result = await commands.productionPage({ mode: 'security' });
    expect(result.londonDual).toMatch(/^£[\d,]+$/);
    expect(result.londonChartLast).toMatch(/^£[\d,]+$/);
    expect(result.initialViolations).toEqual([]);
    expect(result.injectedScriptRan).toBeUndefined();
    expect(result.violations).toHaveLength(2);
    expect(result.unexpectedRequests).toEqual([]);
  });

  it('passes desktop and mobile layout, touch target, color trend, and axe accessibility checks', async () => {
    const result = await commands.productionPage({ mode: 'layout-a11y' });
    expect(result.desktopMetrics?.overflowX).toBe(false);
    expect(result.desktopMetrics?.nextColor).toBe('rgb(248, 113, 113)');
    expect(result.desktopViolations).toEqual([]);
    expect(result.mobileMetrics?.overflowX).toBe(false);
    expect(result.mobileMetrics?.regionTouchHeight).toBeGreaterThanOrEqual(44);
    expect(result.mobileMetrics?.paymentTouchHeight).toBeGreaterThanOrEqual(44);
    expect(result.mobileMetrics?.preservedRegion).toBe('london');
    expect(result.mobileMetrics?.preservedPayment).toBe('prepayment');
    expect(result.londonPrepayDesktop).toBe(result.londonPrepayMobile);
    expect(result.unexpectedRequests).toEqual([]);
  });
});
