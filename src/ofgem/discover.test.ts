import { describe, expect, it } from 'vitest';
import { discoverLatestAnnex9Workbook } from './discover';

describe('discoverLatestAnnex9Workbook', () => {
  it('picks the newest Annex 9 xlsx link even when an older link appears first', () => {
    const html = `
      <a href='/sites/default/files/2026-08/Annex-9-old.xlsx'>
        Final levelised cap rates model (Annex 9): 1 October to 31 December 2026 [XLSX]
      </a>
      <a href="/sites/default/files/2026-11/annex-9-levelisation-allowance-methodology-and-levelised-cap-levels.xlsx">
        Final levelised cap rates model (Annex 9): 1 January to 31 March 2027 [XLSX, 1.39MB]
      </a>
    `;
    const result = discoverLatestAnnex9Workbook(html);
    expect(result).toEqual({
      workbookUrl:
        'https://www.ofgem.gov.uk/sites/default/files/2026-11/annex-9-levelisation-allowance-methodology-and-levelised-cap-levels.xlsx',
      workbookFilename: 'annex-9-levelisation-allowance-methodology-and-levelised-cap-levels.xlsx',
      linkLabel:
        'Final levelised cap rates model (Annex 9): 1 January to 31 March 2027 [XLSX, 1.39MB]',
    });
  });

  it('supports single-quoted href attributes', () => {
    const html = `<a href='/sites/default/files/2026-11/annex-9.xlsx'>Annex 9: Jan to Mar 2027</a>`;
    expect(discoverLatestAnnex9Workbook(html).workbookUrl).toBe(
      'https://www.ofgem.gov.uk/sites/default/files/2026-11/annex-9.xlsx',
    );
  });

  it('rejects links pointing off www.ofgem.gov.uk', () => {
    const html = `<a href="https://evil.example/annex-9-model.xlsx">Annex 9</a>`;
    expect(() => discoverLatestAnnex9Workbook(html)).toThrow('Refusing unexpected Annex 9 host');
  });

  it('throws when no Annex 9 link exists', () => {
    const html = `<a href="/sites/default/files/other.xlsx">Unrelated spreadsheet</a>`;
    expect(() => discoverLatestAnnex9Workbook(html)).toThrow('Could not locate an Ofgem Annex 9');
  });
});
