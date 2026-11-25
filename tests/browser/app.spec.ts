import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

const SITE_URL = 'https://price-cap.streefland.co.uk';

const EXPECTED_TREND_COLORS: Record<string, string> = {
  up: 'rgb(248, 113, 113)',
  down: 'rgb(52, 211, 153)',
  flat: 'rgb(229, 231, 235)',
};

describe('production static build', () => {
  it('renders complete Design 3 content, SEO metadata, social card, and hides JS-only controls without JavaScript', async () => {
    const result = await commands.productionPage({ mode: 'static' });
    if (result.metadata === undefined) throw new Error('Expected static production metadata');

    expect(result.status).toBe(200);
    expect(result.title).toBe('Ofgem price cap');
    expect(result.headingVisible).toBe(true);
    expect(result.controlsVisible).toBe(false);
    expect(result.creditVisible).toBe(true);
    expect(result.disclaimerVisible).toBe(true);
    expect(result.chartVisible).toBe(true);
    expect(result.faviconStatus).toBe(200);
    expect(result.currentDual).toMatch(/^£[\d,]+$/);
    if (result.nextDual !== null) {
      expect(result.nextDual).toMatch(/^£[\d,]+$/);
      expect(result.timingText).toBe(' vs current quarter');
    }

    const head = new DOMParser().parseFromString(result.metadata, 'text/html');
    expect(head.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b0d0f');
    expect(head.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark');
    expect(head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow',
    );
    expect(head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE_URL}/`);
    expect(head.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(
      /Current UK Ofgem energy price cap is £[\d,]+\/year/,
    );
    expect(head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      `${SITE_URL}/`,
    );
    expect(head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      `${SITE_URL}/social-card.png`,
    );
    expect(head.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
      'summary_large_image',
    );
    expect(head.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(
      `${SITE_URL}/social-card.png`,
    );

    const ldJsonText = head.querySelector('script[type="application/ld+json"]')?.textContent;
    expect(ldJsonText).toBeTruthy();
    const ldJson = JSON.parse(ldJsonText ?? '{}');
    expect(ldJson['@type']).toBe('WebApplication');
    expect(ldJson.name).toBe('Ofgem price cap');
    expect(ldJson.url).toBe(`${SITE_URL}/`);

    expect(result.image).toEqual({
      status: 200,
      contentType: 'image/png',
      signature: 0x89504e47,
      dimensions: [1200, 630],
    });
    expect(result.robots?.status).toBe(200);
    expect(result.robots?.text).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    expect(result.sitemap?.status).toBe(200);
    expect(result.sitemap?.text).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(result.unexpectedRequests).toEqual([]);
  });

  it('enforces hash-based strict production CSP and updates rates and chart progressively', async () => {
    const result = await commands.productionPage({ mode: 'security' });
    expect(result.controlsVisibleWithJs).toBe(true);
    if (result.timingTextWithJs !== null) {
      expect(result.timingTextWithJs).toMatch(
        /(effective (tomorrow|in \d+ days)|vs current quarter)/,
      );
    }
    expect(result.londonDual).toMatch(/^£[\d,]+$/);
    expect(result.londonChartLast).toMatch(/^£[\d,]+$/);
    expect(result.initialViolations).toEqual([]);
    expect(result.injectedScriptRan).toBeUndefined();
    expect(result.violations).toHaveLength(3);
    expect(result.unexpectedRequests).toEqual([]);
  });

  it('passes desktop and mobile layout, touch target, color trend, and axe accessibility checks', async () => {
    const result = await commands.productionPage({ mode: 'layout-a11y' });
    expect(result.desktopMetrics?.overflowX).toBe(false);
    if (result.desktopMetrics?.nextColor !== null && result.desktopMetrics?.rootTrend) {
      expect(result.desktopMetrics.nextColor).toBe(
        EXPECTED_TREND_COLORS[result.desktopMetrics.rootTrend],
      );
    }
    for (const rate of result.desktopMetrics?.rateTrends ?? []) {
      expect(rate.color).toBe(EXPECTED_TREND_COLORS[rate.trend]);
      expect(rate.deltaText).toMatch(/^[+-]?\d+\.\d{2}p \([+-]?\d+(?:\.\d+)?%\)$/);
    }
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
