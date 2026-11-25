# Ofgem price cap

Static, single-file UK energy price cap dashboard displaying official Ofgem default tariff cap levels, regional unit rates, standing charges, and quarterly comparisons across Great Britain.

Live site: [https://price-cap.streefland.co.uk](https://price-cap.streefland.co.uk)

## Quick start

```sh
npm ci
npm run data:update
npm run dev
```

## Checks

```sh
npm run format:check
npm run test:coverage -- --maxWorkers=1
npm run build
npm run typecheck:browser
npm run test:browser:build
```

## Architecture, privacy, and limits

- **Single-request static build**: `npm run build` pre-renders the complete HTML, SVG step chart, SEO metadata, and compact regional lookup matrix, and inlines CSS and minimal progressive-enhancement JavaScript directly into `dist/index.html` (~10 kB gzipped total) with zero runtime frameworks, zero bundled web fonts, and zero runtime network calls (`connect-src 'none'`).
- **Accessible without JavaScript**: The Great Britain average headline, unit rates, standing charges, quarterly step profile, and full 14-region table render completely with JavaScript disabled (while JS-only filter dropdowns hide via a hash-authorised `<noscript>` rule). With JavaScript enabled, dropdowns switch regions and payment methods instantaneously and display a live day countdown to the next cap.
- **Automated Ofgem updates**: GitHub Actions fetches Ofgem's official Annex 9 `.xlsx` workbook twice a week, commits updates to `data/price-cap.json`, and redeploys GitHub Pages only when data changes (plus on quarterly rollover dates: 1 Jan, 1 Apr, 1 Jul, and 1 Oct).
- **Data scope and privacy**: No backend, no cookies, and no tracking. Figures cover Great Britain (England, Scotland, and Wales); Northern Ireland is outside the Ofgem price cap. Data is provided for information only; use at your own risk.

## Links

- [Architecture decisions](docs/ADR.md)
- [Calculation methodology](docs/methodology.md)
- [Working agreement](AGENTS.md)
