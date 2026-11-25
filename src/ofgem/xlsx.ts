import { strFromU8, unzipSync } from 'fflate';

export interface SheetCell {
  col: string;
  value: string;
  formula?: string;
}

export type SheetRows = Map<number, Map<string, SheetCell>>;

export interface WorkbookArchive {
  sheetNames: string[];
  readSheet: (sheetName: string) => SheetRows;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function getAttribute(tagText: string, attributeName: string): string | null {
  const pattern = new RegExp(`\\b${attributeName}\\s*=\\s*"([^"]*)"`);
  const match = pattern.exec(tagText);
  return match ? decodeXmlEntities(match[1]) : null;
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  const textPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let siMatch: RegExpExecArray | null = siPattern.exec(xml);
  while (siMatch !== null) {
    const inner = siMatch[1];
    textPattern.lastIndex = 0;
    let combined = '';
    let tMatch: RegExpExecArray | null = textPattern.exec(inner);
    while (tMatch !== null) {
      combined += decodeXmlEntities(tMatch[1]);
      tMatch = textPattern.exec(inner);
    }
    strings.push(combined);
    siMatch = siPattern.exec(xml);
  }
  return strings;
}

function parseRelationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const relPattern = /<Relationship\b([^>]*)\/?>/g;
  let match: RegExpExecArray | null = relPattern.exec(xml);
  while (match !== null) {
    const attrs = match[1];
    const id = getAttribute(attrs, 'Id');
    const target = getAttribute(attrs, 'Target');
    if (id && target) {
      map.set(id, target);
    }
    match = relPattern.exec(xml);
  }
  return map;
}

function parseSheetTargets(params: {
  workbookXml: string;
  relationships: Map<string, string>;
}): Map<string, string> {
  const targets = new Map<string, string>();
  const sheetPattern = /<sheet\b([^>]*)\/?>/g;
  let match: RegExpExecArray | null = sheetPattern.exec(params.workbookXml);
  while (match !== null) {
    const attrs = match[1];
    const name = getAttribute(attrs, 'name');
    const relId = getAttribute(attrs, 'r:id');
    if (name && relId) {
      const target = params.relationships.get(relId);
      if (target) {
        const normalised = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
        targets.set(name, normalised);
      }
    }
    match = sheetPattern.exec(params.workbookXml);
  }
  return targets;
}

function parseWorksheetRows(params: { xml: string; sharedStrings: string[] }): SheetRows {
  const rows: SheetRows = new Map();
  const rowPattern = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  const cellPattern = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
  const valuePattern = /<v\b[^>]*>([\s\S]*?)<\/v>/;
  const formulaPattern = /<f\b[^>]*>([\s\S]*?)<\/f>/;
  const inlineTextPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;

  let rowMatch: RegExpExecArray | null = rowPattern.exec(params.xml);
  while (rowMatch !== null) {
    const rowNumberText = getAttribute(rowMatch[1], 'r');
    if (rowNumberText) {
      const rowNumber = Number.parseInt(rowNumberText, 10);
      const rowCells = new Map<string, SheetCell>();
      const rowInner = rowMatch[2];
      cellPattern.lastIndex = 0;
      let cellMatch: RegExpExecArray | null = cellPattern.exec(rowInner);

      while (cellMatch !== null) {
        const cellAttrs = cellMatch[1];
        const cellInner = cellMatch[2] ?? '';
        const ref = getAttribute(cellAttrs, 'r');
        const colMatch = ref ? /^([A-Z]+)/.exec(ref) : null;

        if (colMatch) {
          const col = colMatch[1];
          const type = getAttribute(cellAttrs, 't');
          const formulaMatch = formulaPattern.exec(cellInner);
          const formula = formulaMatch ? decodeXmlEntities(formulaMatch[1]) : undefined;
          let value: string | null = null;

          if (type === 'inlineStr') {
            inlineTextPattern.lastIndex = 0;
            let text = '';
            let inlineMatch: RegExpExecArray | null = inlineTextPattern.exec(cellInner);
            while (inlineMatch !== null) {
              text += decodeXmlEntities(inlineMatch[1]);
              inlineMatch = inlineTextPattern.exec(cellInner);
            }
            value = text;
          } else {
            const valueMatch = valuePattern.exec(cellInner);
            if (valueMatch) {
              const rawValue = decodeXmlEntities(valueMatch[1]);
              if (type === 's') {
                const index = Number.parseInt(rawValue, 10);
                value = params.sharedStrings[index] ?? '';
              } else {
                value = rawValue;
              }
            }
          }

          if (value !== null) {
            rowCells.set(col, { col, value, formula });
          }
        }
        cellMatch = cellPattern.exec(rowInner);
      }

      if (rowCells.size > 0) {
        rows.set(rowNumber, rowCells);
      }
    }
    rowMatch = rowPattern.exec(params.xml);
  }

  return rows;
}

export function openXlsxWorkbook(bytes: Uint8Array): WorkbookArchive {
  const files = unzipSync(bytes);
  const workbookBytes = files['xl/workbook.xml'];
  const relsBytes = files['xl/_rels/workbook.xml.rels'];
  if (!workbookBytes || !relsBytes) {
    throw new Error('Invalid XLSX workbook: missing workbook metadata.');
  }

  const workbookXml = strFromU8(workbookBytes);
  const relsXml = strFromU8(relsBytes);
  const sharedStringsBytes = files['xl/sharedStrings.xml'];
  const sharedStrings = sharedStringsBytes ? parseSharedStrings(strFromU8(sharedStringsBytes)) : [];
  const relationships = parseRelationships(relsXml);
  const sheetTargets = parseSheetTargets({ workbookXml, relationships });

  return {
    sheetNames: Array.from(sheetTargets.keys()),
    readSheet(sheetName: string): SheetRows {
      const target = sheetTargets.get(sheetName);
      if (!target) {
        throw new Error(`Worksheet "${sheetName}" not found in workbook.`);
      }
      const sheetBytes = files[target];
      if (!sheetBytes) {
        throw new Error(`Worksheet XML "${target}" missing from XLSX archive.`);
      }
      return parseWorksheetRows({ xml: strFromU8(sheetBytes), sharedStrings });
    },
  };
}
