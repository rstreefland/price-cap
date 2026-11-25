import axe from 'axe-core';
import type { BrowserCommandContext } from 'vitest/node';

export async function resetRoutes({ page }: BrowserCommandContext) {
  await page.unrouteAll({ behavior: 'wait' });
  await page.route(/^https?:\/\//, (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      return route.continue();
    }
    throw new Error(`Unexpected external browser request: ${url.origin}`);
  });
}

export async function productionPage(
  { context, project }: BrowserCommandContext,
  options: { mode: 'static' | 'security' | 'layout-a11y' },
) {
  const productionURL = project.getProvidedContext().productionURL;
  const browser = context.browser();
  if (!browser) throw new Error('Production checks require a connected browser');

  const productionContext = await browser.newContext({
    javaScriptEnabled: options.mode !== 'static',
    bypassCSP: options.mode === 'layout-a11y',
    viewport: { width: 1280, height: 900 },
  });
  const page = await productionContext.newPage();
  const unexpectedRequests: string[] = [];

  await page.route(/^https?:\/\//, (route) => {
    if (new URL(route.request().url()).origin === productionURL) {
      return route.continue();
    }
    unexpectedRequests.push(route.request().url());
    return route.abort();
  });

  try {
    if (options.mode === 'security') {
      await page.addInitScript(() => {
        window.cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          window.cspViolations.push(event.violatedDirective);
        });
      });
    }

    const response = await page.goto(productionURL);
    if (options.mode === 'static') {
      const metadata = await page.locator('head').innerHTML();
      const favicon = await page.request.get(new URL('/favicon.svg', productionURL).href);
      const image = await page.request.get(new URL('/social-card.png', productionURL).href);
      const bytes = await image.body();
      const robots = await page.request.get(new URL('/robots.txt', productionURL).href);
      const sitemap = await page.request.get(new URL('/sitemap.xml', productionURL).href);

      return {
        status: response?.status(),
        title: await page.title(),
        metadata,
        headingVisible: await page
          .getByRole('heading', { name: 'Ofgem price cap', exact: true })
          .isVisible(),
        controlsVisible: await page.locator('.controls-bar').isVisible(),
        creditVisible: await page.getByText('Created by Rhys Streefland').isVisible(),
        disclaimerVisible: await page.getByText(/use at your own risk/i).isVisible(),
        currentDual: await page.locator('[data-field="cur-dual"]').textContent(),
        nextDual: await page.locator('[data-field="nxt-dual"]').textContent(),
        chartVisible: await page.locator('[data-chart-svg]').isVisible(),
        faviconStatus: favicon.status(),
        image: {
          status: image.status(),
          contentType: image.headers()['content-type'],
          signature: bytes.readUInt32BE(0),
          dimensions: [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
        },
        robots: { status: robots.status(), text: await robots.text() },
        sitemap: { status: sitemap.status(), text: await sitemap.text() },
        unexpectedRequests,
      };
    }

    await page.getByRole('heading', { name: 'Ofgem price cap', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);

    if (options.mode === 'layout-a11y') {
      const desktopMetrics = await page.evaluate(() => {
        const nextFigure = document.querySelector('[data-field="nxt-dual"]');
        const nextColor = nextFigure ? getComputedStyle(nextFigure).color : '';
        return {
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          nextColor,
        };
      });

      const axeSource = axe.source;
      const desktopViolations = await page.evaluate(async (source) => {
        const run = new Function(`${source}; return window.axe.run();`);
        const report = await run();
        return report.violations.map((v: { id: string }) => v.id);
      }, axeSource);

      await page.getByLabel('Region', { exact: true }).selectOption('london');
      await page.getByLabel('Payment method', { exact: true }).selectOption('prepayment');
      const londonPrepayDesktop = await page.locator('[data-field="cur-dual"]').textContent();

      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => document.fonts.ready);

      const mobileMetrics = await page.evaluate(() => {
        const regionSelect = document.getElementById('region-select');
        const paymentSelect = document.getElementById('payment-select');
        const regionRect = regionSelect ? regionSelect.getBoundingClientRect() : null;
        const paymentRect = paymentSelect ? paymentSelect.getBoundingClientRect() : null;
        return {
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          regionTouchHeight: regionRect ? regionRect.height : 0,
          paymentTouchHeight: paymentRect ? paymentRect.height : 0,
          preservedRegion: regionSelect instanceof HTMLSelectElement ? regionSelect.value : '',
          preservedPayment: paymentSelect instanceof HTMLSelectElement ? paymentSelect.value : '',
        };
      });

      const londonPrepayMobile = await page.locator('[data-field="cur-dual"]').textContent();

      return {
        desktopMetrics,
        desktopViolations,
        mobileMetrics,
        londonPrepayDesktop,
        londonPrepayMobile,
        unexpectedRequests,
      };
    }

    const controlsVisibleWithJs = await page.locator('.controls-bar').isVisible();
    await page.getByLabel('Region', { exact: true }).selectOption('london');
    const londonDual = await page.locator('[data-field="cur-dual"]').textContent();
    const londonChartLast = await page
      .locator('[data-chart-step="5"] .chart-step-value')
      .textContent();
    const initialViolations = await page.evaluate(() => window.cspViolations);

    await page.evaluate(async () => {
      const script = document.createElement('script');
      script.textContent = 'window.injectedScriptRan = true';
      document.body.appendChild(script);
      const style = document.createElement('style');
      style.textContent = 'body { background: red; }';
      document.head.appendChild(style);
      try {
        await fetch('https://unapproved.invalid/');
      } catch {}
    });

    await page.waitForFunction(() => window.cspViolations.length === 3);

    return {
      controlsVisibleWithJs,
      londonDual,
      londonChartLast,
      initialViolations,
      injectedScriptRan: await page.evaluate(() => window.injectedScriptRan),
      violations: await page.evaluate(() => window.cspViolations),
      unexpectedRequests,
    };
  } finally {
    await productionContext.close();
  }
}

declare module 'vitest/browser' {
  interface BrowserCommands {
    resetRoutes: () => Promise<void>;
    productionPage: (options: {
      mode: 'static' | 'security' | 'layout-a11y';
    }) => ReturnType<typeof productionPage>;
  }
}

declare module 'vitest' {
  interface ProvidedContext {
    productionURL: string;
  }
}

declare global {
  interface Window {
    cspViolations: string[];
    injectedScriptRan?: boolean;
  }
}
