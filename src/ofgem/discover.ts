export const OFGEM_ORIGIN = 'https://www.ofgem.gov.uk';
export const OFGEM_INDEX_URL =
  'https://www.ofgem.gov.uk/energy-regulation/domestic-and-non-domestic/energy-pricing-rules/energy-price-cap/energy-price-cap-default-tariff-levels';

export interface DiscoveredWorkbook {
  workbookUrl: string;
  workbookFilename: string;
  linkLabel: string;
}

const ANCHOR_PATTERN = /<a\b[^>]*\bhref\s*=\s*"([^"]+\.xlsx(?:\?[^"]*)?)"[^>]*>([\s\S]*?)<\/a>/gi;

function stripTags(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAnnex9Link(params: { href: string; label: string }): boolean {
  const combined = `${params.href} ${params.label}`.toLowerCase();
  return (
    combined.includes('annex-9') ||
    combined.includes('annex_9') ||
    combined.includes('annex 9') ||
    combined.includes('levelised cap rates model') ||
    combined.includes('levelised-cap-levels')
  );
}

export function discoverLatestAnnex9Workbook(html: string): DiscoveredWorkbook {
  ANCHOR_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = ANCHOR_PATTERN.exec(html);

  while (match !== null) {
    const rawHref = match[1];
    const label = stripTags(match[2]);

    if (isAnnex9Link({ href: rawHref, label })) {
      const resolved = new URL(rawHref, OFGEM_ORIGIN);
      if (resolved.protocol !== 'https:' || resolved.hostname !== 'www.ofgem.gov.uk') {
        throw new Error(`Refusing unexpected Annex 9 host: ${resolved.origin}`);
      }
      const segments = resolved.pathname.split('/').filter(Boolean);
      const filename = segments[segments.length - 1];
      if (!filename) {
        throw new Error(`Annex 9 URL has no filename: ${resolved.href}`);
      }
      return {
        workbookUrl: resolved.href,
        workbookFilename: decodeURIComponent(filename),
        linkLabel: label,
      };
    }

    match = ANCHOR_PATTERN.exec(html);
  }

  throw new Error('Could not locate an Ofgem Annex 9 levelised cap rates workbook link.');
}
