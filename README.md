# Ofgem price cap

Static, pre-rendered UK energy price cap dashboard displaying official Ofgem default tariff cap levels, regional unit rates, standing charges, and quarterly comparisons across Great Britain.

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

## Privacy and data limits

This site builds to static HTML with minimal progressive-enhancement JavaScript, no frontend framework, no tracking, and no runtime network requests (`connect-src 'none'`). Price cap data is fetched directly from Ofgem's official Annex 9 workbook via GitHub Actions into `data/price-cap.json` and pre-rendered at build time. Figures cover Great Britain (England, Scotland, and Wales); Northern Ireland is outside the Ofgem price cap.

## Links

- [Architecture decisions](docs/ADR.md)
- [Calculation methodology](docs/methodology.md)
- [Working agreement](AGENTS.md)
