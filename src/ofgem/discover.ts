export const OFGEM_ORIGIN = 'https://www.ofgem.gov.uk';
export const OFGEM_INDEX_URL =
  'https://www.ofgem.gov.uk/energy-regulation/domestic-and-non-domestic/energy-pricing-rules/energy-price-cap/energy-price-cap-default-tariff-levels';

export interface DiscoveredWorkbook {
  workbookUrl: string;
  workbookFilename: string;
  linkLabel: string;
}

const ANCHOR_PATTERN =
  /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+\.xlsx(?:\?[^"]*)?)"|'([^']+\.xlsx(?:\?[^']*)?)')[^>]*>([\s\S]*?)<\/a>/gi;

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

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

function extractSortRank(params: { pathname: string; label: string }): number {
  const pathMatch = /\/(\d{4})-(\d{2})\//.exec(params.pathname);
  const pathScore = pathMatch
    ? Number.parseInt(pathMatch[1], 10) * 100 + Number.parseInt(pathMatch[2], 10)
    : 0;

  const labelMatches = Array.from(params.label.matchAll(/\b([A-Za-z]+)\s+(\d{4})\b/g));
  let labelScore = 0;
  for (const match of labelMatches) {
    const month = MONTH_NAME_TO_NUMBER[match[1].toLowerCase()];
    if (month) {
      const candidate = Number.parseInt(match[2], 10) * 100 + month;
      if (candidate > labelScore) labelScore = candidate;
    }
  }

  return labelScore > 0 ? labelScore * 1_000_000 + pathScore : pathScore;
}

export function discoverLatestAnnex9Workbook(html: string): DiscoveredWorkbook {
  ANCHOR_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = ANCHOR_PATTERN.exec(html);

  const candidates: Array<{ workbook: DiscoveredWorkbook; rank: number; order: number }> = [];
  let order = 0;

  while (match !== null) {
    const rawHref = match[1] ?? match[2] ?? '';
    const label = stripTags(match[3] ?? '');

    if (rawHref && isAnnex9Link({ href: rawHref, label })) {
      const resolved = new URL(rawHref, OFGEM_ORIGIN);
      if (resolved.protocol !== 'https:' || resolved.hostname !== 'www.ofgem.gov.uk') {
        throw new Error(`Refusing unexpected Annex 9 host: ${resolved.origin}`);
      }
      const segments = resolved.pathname.split('/').filter(Boolean);
      const filename = segments[segments.length - 1];
      if (!filename) {
        throw new Error(`Annex 9 URL has no filename: ${resolved.href}`);
      }
      candidates.push({
        workbook: {
          workbookUrl: resolved.href,
          workbookFilename: decodeURIComponent(filename),
          linkLabel: label,
        },
        rank: extractSortRank({ pathname: resolved.pathname, label }),
        order,
      });
      order += 1;
    }

    match = ANCHOR_PATTERN.exec(html);
  }

  if (candidates.length === 0) {
    throw new Error('Could not locate an Ofgem Annex 9 levelised cap rates workbook link.');
  }

  candidates.sort((left, right) => {
    if (right.rank !== left.rank) return right.rank - left.rank;
    return left.order - right.order;
  });

  return candidates[0].workbook;
}
