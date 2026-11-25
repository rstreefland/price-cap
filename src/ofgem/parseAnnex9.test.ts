import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { REGIONS } from '../domain/types';
import {
  parseAnnex9Workbook,
  parseOfgemPeriodHeading,
  tdcvForPeriodStart,
  vatForPeriodStart,
} from './parseAnnex9';
import { openXlsxWorkbook } from './xlsx';

const FOURTEEN_REGIONS = REGIONS.filter((region) => region.id !== 'gb-average');

function buildSheetXml(
  rows: Array<{ r: number; cells: Array<{ ref: string; value: string; isString?: boolean }> }>,
): string {
  const rowXml = rows
    .map((row) => {
      const cellsXml = row.cells
        .map((cell) =>
          cell.isString
            ? `<c r="${cell.ref}" t="inlineStr"><is><t>${cell.value}</t></is></c>`
            : `<c r="${cell.ref}"><v>${cell.value}</v></c>`,
        )
        .join('');
      return `<row r="${row.r}">${cellsXml}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
}

function buildPaymentSheetXml(params: {
  keyToken: string;
  elecNilOct: string;
  elecBenchOct: string;
  gasNilOct: string;
  gasBenchOct: string;
  elecNilJan: string;
  elecBenchJan: string;
  gasNilJan: string;
  gasBenchJan: string;
}): string {
  const rows: Array<{
    r: number;
    cells: Array<{ ref: string; value: string; isString?: boolean }>;
  }> = [
    {
      r: 9,
      cells: [
        { ref: 'R9', value: 'October 2026 - December 2026', isString: true },
        { ref: 'S9', value: 'January 2027 - March 2027', isString: true },
        { ref: 'T9', value: 'April 2027 - June 2027', isString: true },
      ],
    },
  ];

  let rowNum = 12;
  for (const region of FOURTEEN_REGIONS) {
    rows.push({
      r: rowNum,
      cells: [
        {
          ref: `A${rowNum}`,
          value: `ElecSingle_${params.keyToken}_Nil_${region.ofgemLabel}`,
          isString: true,
        },
        { ref: `R${rowNum}`, value: params.elecNilOct },
        { ref: `S${rowNum}`, value: params.elecNilJan },
        { ref: `T${rowNum}`, value: '-', isString: true },
      ],
    });
    rowNum += 1;
  }

  for (const region of FOURTEEN_REGIONS) {
    rows.push({
      r: rowNum,
      cells: [
        {
          ref: `A${rowNum}`,
          value: `Gas_${params.keyToken}_Nil_${region.ofgemLabel}`,
          isString: true,
        },
        { ref: `R${rowNum}`, value: params.gasNilOct },
        { ref: `S${rowNum}`, value: params.gasNilJan },
        { ref: `T${rowNum}`, value: '-', isString: true },
      ],
    });
    rowNum += 1;
  }

  for (const region of FOURTEEN_REGIONS) {
    rows.push({
      r: rowNum,
      cells: [
        {
          ref: `A${rowNum}`,
          value: `ElecSingle_${params.keyToken}_Benchmark_${region.ofgemLabel}`,
          isString: true,
        },
        { ref: `R${rowNum}`, value: params.elecBenchOct },
        { ref: `S${rowNum}`, value: params.elecBenchJan },
        { ref: `T${rowNum}`, value: '-', isString: true },
      ],
    });
    rowNum += 1;
  }

  for (const region of FOURTEEN_REGIONS) {
    rows.push({
      r: rowNum,
      cells: [
        {
          ref: `A${rowNum}`,
          value: `Gas_${params.keyToken}_Benchmark_${region.ofgemLabel}`,
          isString: true,
        },
        { ref: `R${rowNum}`, value: params.gasBenchOct },
        { ref: `S${rowNum}`, value: params.gasBenchJan },
        { ref: `T${rowNum}`, value: '-', isString: true },
      ],
    });
    rowNum += 1;
  }

  return buildSheetXml(rows);
}

function buildSyntheticAnnex9Bytes(): Uint8Array {
  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets>
        <sheet name="1a Levelised DTC" sheetId="1" r:id="rId1" />
        <sheet name="2a Historical_Other" sheetId="2" r:id="rId2" />
        <sheet name="2b Historical_SC" sheetId="3" r:id="rId3" />
        <sheet name="2c Historical_PPM" sheetId="4" r:id="rId4" />
      </sheets>
    </workbook>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Target="worksheets/sheet1.xml" />
      <Relationship Id="rId2" Target="worksheets/sheet2.xml" />
      <Relationship Id="rId3" Target="worksheets/sheet3.xml" />
      <Relationship Id="rId4" Target="worksheets/sheet4.xml" />
    </Relationships>`;

  const sheet1 = buildSheetXml([
    { r: 6, cells: [{ ref: 'C6', value: 'January 2027 - March 2027', isString: true }] },
  ]);

  const sheet2 = buildPaymentSheetXml({
    keyToken: 'Other',
    elecNilOct: '200.1295',
    elecBenchOct: '858.1295',
    gasNilOct: '103.17333333333333',
    gasBenchOct: '824.22095238095238',
    elecNilJan: '199.89928571428572',
    elecBenchJan: '1017.1607142857143',
    gasNilJan: '103.05857142857143',
    gasBenchJan: '1094.4735714285712',
  });

  const sheet3 = buildPaymentSheetXml({
    keyToken: 'SC',
    elecNilOct: '231.00',
    elecBenchOct: '920.00',
    gasNilOct: '130.00',
    gasBenchOct: '890.00',
    elecNilJan: '231.29',
    elecBenchJan: '1094.23',
    gasNilJan: '129.93',
    gasBenchJan: '1174.57',
  });

  const sheet4 = buildPaymentSheetXml({
    keyToken: 'PPM',
    elecNilOct: '200.13',
    elecBenchOct: '838.00',
    gasNilOct: '103.17',
    gasBenchOct: '799.00',
    elecNilJan: '199.90',
    elecBenchJan: '992.30',
    gasNilJan: '103.06',
    gasBenchJan: '1062.49',
  });

  return zipSync({
    'xl/workbook.xml': strToU8(workbookXml),
    'xl/_rels/workbook.xml.rels': strToU8(relsXml),
    'xl/worksheets/sheet1.xml': strToU8(sheet1),
    'xl/worksheets/sheet2.xml': strToU8(sheet2),
    'xl/worksheets/sheet3.xml': strToU8(sheet3),
    'xl/worksheets/sheet4.xml': strToU8(sheet4),
  });
}

describe('parseAnnex9Workbook', () => {
  it('parses Ofgem period headings, TDCV schedules, and VAT rules', () => {
    expect(parseOfgemPeriodHeading('January 2027 - March 2027')).toEqual({
      id: '2027-01',
      label: '1 Jan to 31 Mar 2027',
      shortLabel: 'Jan to Mar 2027',
      startDate: '2027-01-01',
      endDateInclusive: '2027-03-31',
      endDateExclusive: '2027-04-01',
    });
    expect(parseOfgemPeriodHeading('January - March 2027')).toEqual({
      id: '2027-01',
      label: '1 Jan to 31 Mar 2027',
      shortLabel: 'Jan to Mar 2027',
      startDate: '2027-01-01',
      endDateInclusive: '2027-03-31',
      endDateExclusive: '2027-04-01',
    });
    expect(parseOfgemPeriodHeading('Invalid label')).toBeNull();

    expect(tdcvForPeriodStart('2019-01-01')).toEqual({
      electricitySingleKwh: '3100',
      electricityMultiKwh: '4200',
      gasKwh: '12000',
    });
    expect(tdcvForPeriodStart('2022-04-01')).toEqual({
      electricitySingleKwh: '2900',
      electricityMultiKwh: '4200',
      gasKwh: '12000',
    });
    expect(tdcvForPeriodStart('2025-10-01')).toEqual({
      electricitySingleKwh: '2700',
      electricityMultiKwh: '3900',
      gasKwh: '11500',
    });
    expect(tdcvForPeriodStart('2026-07-01')).toEqual({
      electricitySingleKwh: '2500',
      electricityMultiKwh: '3400',
      gasKwh: '9500',
    });

    expect(vatForPeriodStart('2026-07-01')).toEqual({ electricityRate: '0.05', gasRate: '0.05' });
    expect(vatForPeriodStart('2026-10-01')).toEqual({ electricityRate: '0', gasRate: '0.05' });
    expect(vatForPeriodStart('2027-01-01')).toEqual({ electricityRate: '0', gasRate: '0.05' });
    expect(vatForPeriodStart('2027-07-01')).toEqual({ electricityRate: '0.05', gasRate: '0.05' });
  });

  it('derives exact GB average unit rates, standing charges, and annual bills matching Ofgem', () => {
    const dataset = parseAnnex9Workbook({
      bytes: buildSyntheticAnnex9Bytes(),
      indexUrl: 'https://www.ofgem.gov.uk/index',
      workbookUrl: 'https://www.ofgem.gov.uk/annex-9.xlsx',
      workbookFilename: 'annex-9.xlsx',
      generatedAt: '2026-11-25T10:00:00Z',
    });

    expect(dataset.source.latestAnnouncedPeriodId).toBe('2027-01');
    expect(dataset.periods.map((period) => period.id)).toEqual(['2026-10', '2027-01']);

    const jan2027 = dataset.periods[1].rates['direct-debit']['gb-average'];
    expect(jan2027.electricity.unitRatePence).toBe('32.6905');
    expect(jan2027.electricity.standingChargePence).toBe('54.7669');
    expect(jan2027.gas.unitRatePence).toBe('10.9577');
    expect(jan2027.gas.standingChargePence).toBe('29.6470');
    expect(jan2027.dualFuelAnnualPounds).toBe('2166.3579');
  });

  it('reads shared strings and rejects invalid workbooks or missing worksheets', () => {
    const sharedStringsXml =
      '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Hello &amp; &#65; &#x42;</t></si></sst>';
    const workbookXml =
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Test" sheetId="1" r:id="rId1" /></sheets></workbook>';
    const relsXml =
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml" /></Relationships>';
    const sheetXml =
      '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><f>A1</f><v>0</v></c></row></sheetData></worksheet>';

    const bytes = zipSync({
      'xl/workbook.xml': strToU8(workbookXml),
      'xl/_rels/workbook.xml.rels': strToU8(relsXml),
      'xl/sharedStrings.xml': strToU8(sharedStringsXml),
      'xl/worksheets/sheet1.xml': strToU8(sheetXml),
    });

    const wb = openXlsxWorkbook(bytes);
    expect(wb.sheetNames).toEqual(['Test']);
    expect(wb.readSheet('Test').get(1)?.get('A')).toEqual({
      col: 'A',
      value: 'Hello & A B',
      formula: 'A1',
    });
    expect(() => wb.readSheet('Missing')).toThrow('Worksheet "Missing" not found');
    expect(() => openXlsxWorkbook(zipSync({}))).toThrow('Invalid XLSX workbook');
  });

  it('handles single-quoted XML attributes, relative targets, implicit row numbers, and out-of-bounds shared strings', () => {
    const sharedStringsXml =
      "<?xml version='1.0' encoding='UTF-8'?><sst xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'><si><t>Value</t></si></sst>";
    const workbookXml =
      "<?xml version='1.0' encoding='UTF-8'?><workbook xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><sheets><sheet name='S' sheetId='1' r:id='rId1' /></sheets></workbook>";
    const relsXml =
      "<?xml version='1.0' encoding='UTF-8'?><Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Target='./worksheets/sheet1.xml' /></Relationships>";
    const sheetXml =
      "<?xml version='1.0' encoding='UTF-8'?><worksheet xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'><sheetData><row><c r='A1' t='s'><v>0</v></c></row></sheetData></worksheet>";

    const wb = openXlsxWorkbook(
      zipSync({
        'xl/workbook.xml': strToU8(workbookXml),
        'xl/_rels/workbook.xml.rels': strToU8(relsXml),
        'xl/sharedStrings.xml': strToU8(sharedStringsXml),
        'xl/worksheets/sheet1.xml': strToU8(sheetXml),
      }),
    );
    expect(wb.readSheet('S').get(1)?.get('A')?.value).toBe('Value');

    const badSheetXml =
      "<?xml version='1.0' encoding='UTF-8'?><worksheet xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'><sheetData><row r='1'><c r='A1' t='s'><v>99</v></c></row></sheetData></worksheet>";
    const badWb = openXlsxWorkbook(
      zipSync({
        'xl/workbook.xml': strToU8(workbookXml),
        'xl/_rels/workbook.xml.rels': strToU8(relsXml),
        'xl/sharedStrings.xml': strToU8(sharedStringsXml),
        'xl/worksheets/sheet1.xml': strToU8(badSheetXml),
      }),
    );
    expect(() => badWb.readSheet('S')).toThrow('Invalid shared string index 99');
  });

  it('rejects VAT mismatches in 1a Levelised DTC, TDCV mismatches in 1c, unparseable 1a!C6, and 2b/2c column drift', () => {
    const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets>
          <sheet name="1a Levelised DTC" sheetId="1" r:id="rId1" />
          <sheet name="1c Consumption adjusted levels" sheetId="2" r:id="rId2" />
          <sheet name="2a Historical_Other" sheetId="3" r:id="rId3" />
          <sheet name="2b Historical_SC" sheetId="4" r:id="rId4" />
          <sheet name="2c Historical_PPM" sheetId="5" r:id="rId5" />
        </sheets>
      </workbook>`;
    const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Target="worksheets/sheet1.xml" />
        <Relationship Id="rId2" Target="worksheets/sheet2.xml" />
        <Relationship Id="rId3" Target="worksheets/sheet3.xml" />
        <Relationship Id="rId4" Target="worksheets/sheet4.xml" />
        <Relationship Id="rId5" Target="worksheets/sheet5.xml" />
      </Relationships>`;

    const base2a = buildPaymentSheetXml({
      keyToken: 'Other',
      elecNilOct: '200.1295',
      elecBenchOct: '858.1295',
      gasNilOct: '103.17333333333333',
      gasBenchOct: '824.22095238095238',
      elecNilJan: '199.89928571428572',
      elecBenchJan: '1017.1607142857143',
      gasNilJan: '103.05857142857143',
      gasBenchJan: '1094.4735714285712',
    });
    const base2b = buildPaymentSheetXml({
      keyToken: 'SC',
      elecNilOct: '231.00',
      elecBenchOct: '920.00',
      gasNilOct: '130.00',
      gasBenchOct: '890.00',
      elecNilJan: '231.29',
      elecBenchJan: '1094.23',
      gasNilJan: '129.93',
      gasBenchJan: '1174.57',
    });
    const base2c = buildPaymentSheetXml({
      keyToken: 'PPM',
      elecNilOct: '200.13',
      elecBenchOct: '838.00',
      gasNilOct: '103.17',
      gasBenchOct: '799.00',
      elecNilJan: '199.90',
      elecBenchJan: '992.30',
      gasNilJan: '103.06',
      gasBenchJan: '1062.49',
    });

    const valid1a = buildSheetXml([
      { r: 6, cells: [{ ref: 'C6', value: 'January 2027 - March 2027', isString: true }] },
      {
        r: 28,
        cells: [
          { ref: 'D28', value: '1017.1607' },
          { ref: 'H28', value: '1094.4736' },
        ],
      },
      {
        r: 29,
        cells: [
          { ref: 'D29', value: '1017.1607' },
          { ref: 'H29', value: '1149.1972' },
          { ref: 'J29', value: '2166.3579' },
        ],
      },
    ]);
    const valid1c = buildSheetXml([
      { r: 7, cells: [{ ref: 'C7', value: '2.5' }] },
      { r: 9, cells: [{ ref: 'C9', value: '9.5' }] },
    ]);

    const parseWith = (overrides: Record<string, string>) =>
      parseAnnex9Workbook({
        bytes: zipSync({
          'xl/workbook.xml': strToU8(workbookXml),
          'xl/_rels/workbook.xml.rels': strToU8(relsXml),
          'xl/worksheets/sheet1.xml': strToU8(overrides.s1 ?? valid1a),
          'xl/worksheets/sheet2.xml': strToU8(overrides.s2 ?? valid1c),
          'xl/worksheets/sheet3.xml': strToU8(overrides.s3 ?? base2a),
          'xl/worksheets/sheet4.xml': strToU8(overrides.s4 ?? base2b),
          'xl/worksheets/sheet5.xml': strToU8(overrides.s5 ?? base2c),
        }),
        indexUrl: 'https://www.ofgem.gov.uk/index',
        workbookUrl: 'https://www.ofgem.gov.uk/annex-9.xlsx',
        workbookFilename: 'annex-9.xlsx',
        generatedAt: '2026-11-25T10:00:00Z',
      });

    expect(parseWith({}).source.latestAnnouncedPeriodId).toBe('2027-01');

    const badVat1a = buildSheetXml([
      { r: 6, cells: [{ ref: 'C6', value: 'January 2027 - March 2027', isString: true }] },
      {
        r: 28,
        cells: [
          { ref: 'D28', value: '1017.1607' },
          { ref: 'H28', value: '1094.4736' },
        ],
      },
      {
        r: 29,
        cells: [
          { ref: 'D29', value: '1068.0187' },
          { ref: 'H29', value: '1149.1972' },
          { ref: 'J29', value: '2217.2159' },
        ],
      },
    ]);
    expect(() => parseWith({ s1: badVat1a })).toThrow('electricity VAT mismatch');

    const badTdcv1c = buildSheetXml([
      { r: 7, cells: [{ ref: 'C7', value: '2.9' }] },
      { r: 9, cells: [{ ref: 'C9', value: '9.5' }] },
    ]);
    expect(() => parseWith({ s2: badTdcv1c })).toThrow('TDCV mismatch');

    const badC6 = buildSheetXml([
      { r: 6, cells: [{ ref: 'C6', value: 'Not a period', isString: true }] },
    ]);
    expect(() => parseWith({ s1: badC6 })).toThrow('Could not parse active period heading');

    const drifted2b = base2b.replace('January 2027 - March 2027', 'April 2027 - June 2027');
    expect(() => parseWith({ s4: drifted2b })).toThrow(
      'Column S period mismatch in "2b Historical_SC"',
    );
  });
});
