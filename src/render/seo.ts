import { formatPercentChange, formatPounds } from '../domain/decimal';
import { buildDashboardSnapshot } from '../domain/priceCap';
import type { Temporal } from '../domain/time';
import type { PriceCapDataset } from '../domain/types';

export const SITE_URL = 'https://price-cap.streefland.co.uk';
export const SITE_TITLE = 'Ofgem price cap';
export const SOCIAL_IMAGE_ALT =
  'Ofgem price cap: Great Britain default tariff rates, standing charges, and quarterly step profile.';

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeJsonForScript(value: string): string {
  return value.replace(/</g, '\\u003c');
}

export function buildSeoDescription(params: {
  dataset: PriceCapDataset;
  referenceDate: Temporal.PlainDate;
}): string {
  const snapshot = buildDashboardSnapshot({
    dataset: params.dataset,
    regionId: 'gb-average',
    paymentMethod: 'direct-debit',
    referenceDate: params.referenceDate,
  });

  const currentBill = formatPounds({ value: snapshot.currentRates.dualFuelAnnualPounds });
  const currentRange = snapshot.currentPeriod.label;

  if (snapshot.upcomingPeriod && snapshot.upcomingRates && snapshot.upcomingVsCurrent) {
    const nextBill = formatPounds({ value: snapshot.upcomingRates.dualFuelAnnualPounds });
    const pct = snapshot.upcomingVsCurrent.percentChange
      ? formatPercentChange({ value: snapshot.upcomingVsCurrent.percentChange })
      : '0%';
    const verb =
      snapshot.upcomingVsCurrent.trend === 'up'
        ? 'rising to'
        : snapshot.upcomingVsCurrent.trend === 'down'
          ? 'falling to'
          : 'staying at';

    return `Current UK Ofgem energy price cap is ${currentBill}/year (${currentRange}), ${verb} ${nextBill}/year (${pct}) for ${snapshot.upcomingPeriod.label}. Compare regional unit rates and standing charges across Great Britain.`;
  }

  return `Current UK Ofgem energy price cap is ${currentBill}/year (${currentRange}). Compare regional electricity and gas unit rates and standing charges across Great Britain.`;
}

export function renderSeoHeadTags(params: {
  dataset: PriceCapDataset;
  referenceDate: Temporal.PlainDate;
  siteUrl?: string;
}): string {
  const base = (params.siteUrl ?? SITE_URL).replace(/\/+$/, '');
  const canonicalUrl = `${base}/`;
  const imageUrl = `${base}/social-card.png`;
  const description = buildSeoDescription({
    dataset: params.dataset,
    referenceDate: params.referenceDate,
  });

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_TITLE,
    url: canonicalUrl,
    description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    inLanguage: 'en-GB',
    author: {
      '@type': 'Person',
      name: 'Rhys Streefland',
    },
    dateModified: params.dataset.generatedAt,
    isBasedOn: params.dataset.source.indexUrl,
  };

  return [
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="en_GB" />`,
    `<meta property="og:site_name" content="${escapeAttr(SITE_TITLE)}" />`,
    `<meta property="og:title" content="${escapeAttr(SITE_TITLE)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeAttr(imageUrl)}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeAttr(SOCIAL_IMAGE_ALT)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(SITE_TITLE)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(imageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeAttr(SOCIAL_IMAGE_ALT)}" />`,
    `<script type="application/ld+json">${escapeJsonForScript(JSON.stringify(structuredData))}</script>`,
  ].join('\n    ');
}
