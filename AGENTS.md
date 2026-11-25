# Repository working agreement

This is a single-file, pre-rendered static UK energy price cap website with zero frontend framework, minimal inlined progressive-enhancement JavaScript, and a GitHub Action that fetches and parses Ofgem's official Annex 9 workbook. Keep complexity proportional to that purpose.

## Dates and times (ADR-002)

- Never use JavaScript `Date` (`new Date`, `Date.now`, `Date.parse`), including in tests, client scripts, and tooling.
- Use Temporal (`temporal-polyfill`) via `src/domain/time.ts` across domain, build, parser, and test code, with `Europe/London` civil dates and half-open intervals.
- In `src/client/enhance.ts`, keep `temporal-polyfill` out of the client bundle; compute the UK civil-day countdown via `Intl.DateTimeFormat` (`Europe/London`) and exact `BigInt` Gregorian day arithmetic.
- Centralise display date formats in `src/domain/time.ts`.

## Numbers and validation (ADR-003)

- Use `decimal.js-light` via `src/domain/decimal.ts` for all numeric arithmetic across domain, rendering, tests, and data-parsing scripts. Never compute with native floating-point arithmetic or `Math.*`.
- Preserve decimal strings at JSON and spreadsheet boundaries, keep `Decimal` through calculations and comparisons, and round explicitly at display or serialisation boundaries.
- Zero type assertions outside test code (`as T`, `as const`, `any`, `!`, `@ts-expect-error`, `@ts-ignore`). Use annotations, narrowing, discriminated unions, or `satisfies`.
- Validate unknown external inputs once at boundaries with Zod v4 configured with `z.config({ jitless: true })`.

## Architecture, performance, and security

- Keep `src/domain/` pure and independent of DOM, network, and storage.
- Keep `src/ofgem/` responsible for discovering and parsing Ofgem's official Annex 9 workbook into `data/price-cap.json`.
- Keep `src/render/` responsible for build-time static HTML, SVG step chart, compact tuple payload, and SEO/JSON-LD generation so the page is complete, fast, and readable without JavaScript.
- Keep `src/client/` strictly minimal, zero-dependency, and progressively enhanced (region/payment switching and live countdown). Never add a frontend framework, bundled web fonts, or runtime network requests (`connect-src 'none'`).
- Preserve the build-time inlining of CSS and JS with exact SHA-256 CSP hashes (`script-src 'sha256-...'`, `style-src 'sha256-...'`, no `'unsafe-inline'`).
- Keep `public/CNAME`, `public/robots.txt`, `public/sitemap.xml`, `public/social-card.svg`, `public/social-card.png`, and `SITE_URL` in `src/render/seo.ts` synchronised whenever hosting metadata changes.
- Never silently default malformed data or conflate missing data with zero.

## UI and accessibility

- Use plain modular CSS (`src/styles/theme.css` plus `src/styles/instrument.css`) and the native system UI font stack.
- Hide JS-only filter controls via the hash-authorised `<noscript>` style rule so no-JS visitors see zero non-functional controls and JS visitors experience zero layout shift.
- Keep mobile and desktop layouts functionally equivalent and preserve selected region and payment method across resizes.
- Use semantic HTML controls, keyboard accessibility, >= 44px touch targets, high contrast, and `prefers-reduced-motion` support.

## Testing and verification

- Keep unit, parser, SEO, and HTML-rendering tests in Vitest `jsdom` with `@vitest/coverage-istanbul` thresholds (`85/75/85/85`).
- Keep real-browser layout, interaction, SEO/social-card, accessibility (`axe-core`), CSP, and no-JS checks in Vitest Browser Mode (`tests/browser/`) running Chromium and WebKit against a fresh build.
- Intercept all browser network requests and fail unexpected external calls. Keep screenshots and traces disabled.
- Keep all GitHub Actions pinned by full commit SHA, with minimal permissions and matching Playwright container digests.
- Run `npm run format:check`, `npm run test:coverage -- --maxWorkers=1`, `npm run build`, `npm run typecheck:browser`, and `npm run test:browser` before marking work complete.
