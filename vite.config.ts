import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { parsePriceCapDataset } from './src/api/schema';
import { renderPageHtml } from './src/render/page';
import { renderSeoHeadTags } from './src/render/seo';
import { todayInLondon } from './src/domain/time';
import { browserConfig } from './vitest.browser.config';

const DATA_PATH = resolve('data/price-cap.json');

const appConfig = defineConfig({
  base: './',
  plugins: [
    {
      name: 'static-price-cap-html',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
          const dataset = parsePriceCapDataset(raw);
          const referenceDate = todayInLondon();
          const seoTags = renderSeoHeadTags({ dataset, referenceDate });
          const rendered = renderPageHtml({ dataset, referenceDate });
          return html
            .replace('<!-- seo-metadata -->', seoTags)
            .replace('<!-- app-content -->', rendered);
        },
      },
    },
    {
      name: 'production-security-policy',
      apply: 'build',
      transformIndexHtml() {
        return [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: [
                "default-src 'none'",
                "script-src 'self'",
                "style-src 'self'",
                "img-src 'self'",
                "connect-src 'none'",
                "base-uri 'none'",
                "form-action 'none'",
                "object-src 'none'",
              ].join('; '),
            },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  ],
  server: { host: '127.0.0.1' },
  test: {
    include: ['src/**/*.test.ts'],
    maxWorkers: 2,
    testTimeout: 20_000,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'istanbul',
      include: [
        'src/api/*.ts',
        'src/domain/*.ts',
        'src/ofgem/*.ts',
        'src/render/*.ts',
        'src/client/*.ts',
      ],
      exclude: ['src/test/**', 'src/ofgem/cli.ts', '**/*.test.ts'],
      reporter: ['text', 'html'],
      thresholds: { statements: 85, branches: 75, functions: 85, lines: 85 },
    },
  },
});

export default defineConfig(({ mode }) => (mode === 'browser' ? browserConfig : appConfig));
