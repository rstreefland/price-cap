import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { parsePriceCapDataset } from './src/api/schema';
import { renderPageHtml } from './src/render/page';
import { renderSeoHeadTags } from './src/render/seo';
import { todayInLondon } from './src/domain/time';
import { browserConfig } from './vitest.browser.config';

const DATA_PATH = resolve('data/price-cap.json');

function sha256CspHash(content: string): string {
  const digest = createHash('sha256').update(content, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

const appConfig = defineConfig({
  base: './',
  build: {
    modulePreload: { polyfill: false },
  },
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
      name: 'inline-css-and-strict-csp',
      apply: 'build',
      enforce: 'post',
      transformIndexHtml: {
        order: 'post',
        handler(html, context) {
          let output = html;
          const styleHashes: string[] = [];

          if (context.bundle) {
            for (const [fileName, asset] of Object.entries(context.bundle)) {
              if (asset.type === 'asset' && fileName.endsWith('.css')) {
                const cssSource =
                  typeof asset.source === 'string'
                    ? asset.source
                    : Buffer.from(asset.source).toString('utf8');
                const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const linkPattern = new RegExp(`<link\\b[^>]*href="[^"]*${escapedName}"[^>]*>\\s*`);
                if (linkPattern.test(output)) {
                  output = output.replace(linkPattern, `<style>${cssSource}</style>`);
                  delete context.bundle[fileName];
                }
              }
            }
          }

          const styleTagPattern = /<style>([\s\S]*?)<\/style>/g;
          let styleMatch: RegExpExecArray | null = styleTagPattern.exec(output);
          while (styleMatch !== null) {
            styleHashes.push(sha256CspHash(styleMatch[1]));
            styleMatch = styleTagPattern.exec(output);
          }

          const styleSrcDirective =
            styleHashes.length > 0 ? `style-src ${styleHashes.join(' ')}` : "style-src 'self'";

          const csp = [
            "default-src 'none'",
            "script-src 'self'",
            styleSrcDirective,
            "img-src 'self'",
            "connect-src 'none'",
            "base-uri 'none'",
            "form-action 'none'",
            "object-src 'none'",
          ].join('; ');

          return {
            html: output,
            tags: [
              {
                tag: 'meta',
                attrs: {
                  'http-equiv': 'Content-Security-Policy',
                  content: csp,
                },
                injectTo: 'head-prepend',
              },
            ],
          };
        },
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
