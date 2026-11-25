import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePriceCapDataset } from '../api/schema';
import { parsePlainDate } from '../domain/time';
import { buildSeoDescription, renderSeoHeadTags, SITE_URL } from './seo';

function loadDataset() {
  const raw = JSON.parse(readFileSync(resolve('data/price-cap.json'), 'utf8'));
  return parsePriceCapDataset(raw);
}

describe('SEO head metadata renderer', () => {
  it('builds live descriptions for rising, falling, and pending upcoming caps', () => {
    const dataset = loadDataset();

    const rising = buildSeoDescription({
      dataset,
      referenceDate: parsePlainDate('2026-11-25'),
    });
    expect(rising).toContain('£1,723/year');
    expect(rising).toContain('rising to £2,166/year (+26%)');

    const falling = buildSeoDescription({
      dataset,
      referenceDate: parsePlainDate('2026-03-01'),
    });
    expect(falling).toContain('£1,758/year');
    expect(falling).toContain('falling to £1,641/year (-7%)');

    const pending = buildSeoDescription({
      dataset,
      referenceDate: parsePlainDate('2027-02-10'),
    });
    expect(pending).toContain('£2,166/year');
    expect(pending).not.toContain('rising to');
    expect(pending).not.toContain('falling to');
  });

  it('renders canonical, Open Graph, Twitter Card, and Schema.org JSON-LD tags', () => {
    const dataset = loadDataset();
    const html = renderSeoHeadTags({
      dataset,
      referenceDate: parsePlainDate('2026-11-25'),
    });

    const doc = new DOMParser().parseFromString(`<head>${html}</head>`, 'text/html');
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE_URL}/`);
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
    expect(doc.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      `${SITE_URL}/`,
    );
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      `${SITE_URL}/social-card.png`,
    );
    expect(doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
      'summary_large_image',
    );
    expect(doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(
      `${SITE_URL}/social-card.png`,
    );

    const ldJsonText = doc.querySelector('script[type="application/ld+json"]')?.textContent;
    expect(ldJsonText).toBeTruthy();
    const ldJson = JSON.parse(ldJsonText ?? '{}');
    expect(ldJson['@type']).toBe('WebApplication');
    expect(ldJson.name).toBe('Ofgem price cap');
    expect(ldJson.url).toBe(`${SITE_URL}/`);
    expect(ldJson.author.name).toBe('Rhys Streefland');
  });
});
