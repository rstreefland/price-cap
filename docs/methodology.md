# Calculation methodology

This document records the official Ofgem data sources, consumption benchmarks, VAT rules, trend rules, and rounding policies used by `price-cap`.

## Source data

Data is fetched directly from Ofgem's official publication page:

- Index page: `https://www.ofgem.gov.uk/energy-regulation/domestic-and-non-domestic/energy-pricing-rules/energy-price-cap/energy-price-cap-default-tariff-levels`
- Workbook: Latest `Final levelised cap rates model (Annex 9)` `.xlsx` file linked on `www.ofgem.gov.uk`

The parser validates that discovered workbook URLs stay on `https://www.ofgem.gov.uk` and extracts:

1. `1a Levelised DTC`: Active announced restriction period label and VAT rule confirmation.
2. `2a Historical_Other` (Direct Debit / Other Payment Method), `2b Historical_SC` (Standard Credit), and `2c Historical_PPM` (Prepayment Meter): Historical and announced charge restriction periods from January 2019 onward across all 14 Great Britain charge restriction regions.

Each region and period provides annual charges excluding VAT for:

- `Nil`: Annual charge at 0 kWh consumption (standing charge component).
- `Benchmark`: Annual charge at Typical Domestic Consumption Values (TDCV).

## Typical Domestic Consumption Values (TDCV)

Ofgem updates benchmark annual consumption periodically:

| Effective periods    | Electricity single-rate (kWh) | Electricity multi-register (kWh) | Gas (kWh) |
| -------------------- | ----------------------------- | -------------------------------- | --------- |
| Jan 2019 to Mar 2020 | 3,100                         | 4,200                            | 12,000    |
| Apr 2020 to Sep 2023 | 2,900                         | 4,200                            | 12,000    |
| Oct 2023 to Jun 2026 | 2,700                         | 3,900                            | 11,500    |
| Jul 2026 onward      | 2,500                         | 3,400                            | 9,500     |

## VAT rates

- Gas: 5% VAT (`1.05`) across all periods.
- Electricity: 0% VAT (`1.00`) from 1 October 2026 to 30 June 2027 (verified against Ofgem's `1a Levelised DTC` VAT rule and consumer rate tables), and 5% VAT (`1.05`) for other periods.

## Rate, trend, and countdown derivations

All numeric arithmetic uses `decimal.js-light` with 40 significant digits and `ROUND_HALF_UP` at explicit display or serialisation boundaries:

- **Standing charge (p/day, inc VAT)**: `(nilAnnualExclVat * vatMultiplier / 365) * 100`, displayed to 2 decimal places.
- **Unit rate (p/kWh, inc VAT)**: `((benchmarkAnnualExclVat - nilAnnualExclVat) * vatMultiplier / tdcvKwh) * 100`, displayed to 2 decimal places.
- **GB average**: Unweighted arithmetic mean across the 14 charge restriction regions, matching Ofgem's `AVERAGE(C14:C27)` calculation in Annex 9 sheet `1a Levelised DTC`.
- **Headline annual dual-fuel bill**: Sum of electricity single-rate and gas typical annual bills (inc VAT) at the period's active TDCV, displayed rounded to the nearest pound.
- **Quarterly comparison and semantic trend**: Absolute difference in pounds and percentage change between consecutive periods. When the next announced cap is higher than the current quarter (`trend: 'up'`), upcoming indicators render in red (`#F87171`); when lower (`trend: 'down'`), they render in green (`#34D399`); when equal (`trend: 'flat'`), they render in neutral ink (`#E5E7EB`).
- **Day countdown**: The static HTML renders `vs current quarter` so cached builds never go stale. When JavaScript is enabled, the browser computes the UK (`Europe/London`) civil-day difference to the upcoming period's `startDate` using `Intl.DateTimeFormat` and exact `BigInt` Gregorian day arithmetic, displaying `effective in N days` or `effective tomorrow` while the start date is in the future.

## Worked verification example

Direct Debit GB average for `1 January to 31 March 2027` (TDCV: 2,500 kWh electricity, 9,500 kWh gas; 0% electricity VAT, 5% gas VAT):

- Electricity single-rate nil avg: `£199.899286` -> `199.899286 / 365 * 100 = 54.77p/day`
- Electricity single-rate benchmark avg: `£1,017.160714` -> `(1017.160714 - 199.899286) / 2500 * 100 = 32.69p/kWh`
- Gas nil avg inc 5% VAT: `£103.058571 * 1.05 = £108.211500` -> `108.211500 / 365 * 100 = 29.65p/day`
- Gas benchmark avg inc 5% VAT: `£1,094.473571 * 1.05 = £1,149.197250` -> `(1149.197250 - 108.211500) / 9500 * 100 = 10.96p/kWh`
- Dual-fuel annual bill inc VAT: `£1,017.160714 + £1,149.197250 = £2,166.36` (displayed as `£2,166`), up `26%` (`+£443`, red `up` trend) from `1 October to 31 December 2026` (`£1,723`).
