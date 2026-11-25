# Repository working agreement

This is a static, pre-rendered UK energy price cap website with zero frontend framework, minimal progressive-enhancement JavaScript, and a GitHub Action that fetches and parses Ofgem's official Annex 9 workbook. Keep complexity proportional to that purpose.

## Dates and times (ADR-002)

- Use Temporal (`temporal-polyfill`) exclusively via `src/domain/time.ts`. Never use JavaScript `Date` (`new Date`, `Date.now`, `Date.parse`), including in tests and scripts.
- Use `Europe/London` civil dates for cap period boundaries and half-open calendar intervals.
- Centralise display date formats in `src/domain/time.ts`.

## Numbers and validation (ADR-003)

- Use `decimal.js-light` via `src/domain/decimal.ts` for all numeric arithmetic, including tests and data-parsing scripts. Never compute with native floating-point arithmetic or `Math.*`.
- Preserve decimal strings at JSON and spreadsheet boundaries, keep `Decimal` through calculations and comparisons, and round explicitly at display or serialisation boundaries.
- Zero type assertions outside test code (`as T`, `as const`, `any`, `!`, `@ts-expect-error`, `@ts-ignore`). Use annotations, narrowing, discriminated unions, or `satisfies`.
- Validate unknown external inputs once at boundaries with Zod v4 configured with `z.config({ jitless: true })` so strict production CSP stays intact.

## Architecture and data integrity

- Keep `src/domain/` pure and independent of DOM, network, and storage.
- Keep `src/ofgem/` responsible for discovering and parsing Ofgem's official Annex 9 workbook into `data/price-cap.json`.
- Keep `src/render/` responsible for build-time static HTML generation so the page is complete, fast, and readable even without JavaScript.
- Keep client-side JavaScript (`src/client/`) strictly minimal and progressively enhanced (for interactive region and payment method switching without page reloads). Never add a frontend framework or runtime network requests (`connect-src 'none'`).
- Never silently default malformed data or conflate missing data with zero.

## UI and accessibility

- Use plain modular CSS (`src/styles/theme.css` plus feature-owned stylesheets) and self-hosted `@fontsource/dm-sans`.
- Keep mobile and desktop layouts functionally equivalent and preserve selected region and payment method across resizes.
- Use semantic HTML controls, keyboard accessibility, adequate touch targets, and `prefers-reduced-motion` support.

## Testing and verification

- Keep unit, parser, and HTML-rendering tests in Vitest `jsdom` with `@vitest/coverage-istanbul` thresholds (`85/75/85/85`).
- Keep real-browser layout, interaction, accessibility (`axe-core`), CSP, and no-JS checks in Vitest Browser Mode (`tests/browser/`) running Chromium and WebKit against a fresh build.
- Intercept all browser network requests and fail unexpected external calls. Keep screenshots and traces disabled.
- Run `npm run format:check`, `npm run test:coverage -- --maxWorkers=1`, `npm run build`, `npm run typecheck:browser`, and `npm run test:browser` before marking work complete.
