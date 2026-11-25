import { parsePriceCapDataset } from '../api/schema';
import { decimal, fixed, type DecimalValue } from '../domain/decimal';
import { formatCompactPeriod, formatDateRange, Temporal } from '../domain/time';
import {
  REGIONS,
  type CapPeriod,
  type FuelRates,
  type PaymentMethodId,
  type PeriodTdcv,
  type PeriodVat,
  type PriceCapDataset,
  type RegionId,
  type RegionalRates,
} from '../domain/types';
import { openXlsxWorkbook, type SheetRows, type WorkbookArchive } from './xlsx';

const DAYS_PER_YEAR = decimal(365);
const PENCE_PER_POUND = decimal(100);
const KWH_PER_MWH = decimal(1000);
const VAT_RATE_TOLERANCE = decimal('0.0005');
const HEADLINE_BILL_TOLERANCE = decimal('0.5');

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

const PAYMENT_SHEETS: ReadonlyArray<{
  paymentMethod: PaymentMethodId;
  sheetName: string;
  keyToken: string;
}> = [
  { paymentMethod: 'direct-debit', sheetName: '2a Historical_Other', keyToken: 'Other' },
  { paymentMethod: 'standard-credit', sheetName: '2b Historical_SC', keyToken: 'SC' },
  { paymentMethod: 'prepayment', sheetName: '2c Historical_PPM', keyToken: 'PPM' },
];

const REGIONAL_IDS: ReadonlyArray<{ id: RegionId; ofgemLabel: string }> = REGIONS.filter(
  (region) => region.id !== 'gb-average',
).map((region) => ({ id: region.id, ofgemLabel: region.ofgemLabel }));

interface ParsedPeriodHeader {
  col: string;
  id: string;
  label: string;
  shortLabel: string;
  startDate: string;
  endDateInclusive: string;
  endDateExclusive: string;
}

function columnLettersToIndex(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i += 1) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result;
}

export function parseOfgemPeriodHeading(heading: string): Omit<ParsedPeriodHeader, 'col'> | null {
  const cleaned = heading.replace(/\u2013|\u2014/g, '-').trim();
  const fullMatch = /^([A-Za-z]+)\s+(\d{4})\s*-\s*([A-Za-z]+)\s+(\d{4})$/.exec(cleaned);
  const sameYearMatch = !fullMatch
    ? /^([A-Za-z]+)\s*-\s*([A-Za-z]+)\s+(\d{4})$/.exec(cleaned)
    : null;

  let startMonthName: string;
  let startYear: number;
  let endMonthName: string;
  let endYear: number;

  if (fullMatch) {
    startMonthName = fullMatch[1];
    startYear = Number.parseInt(fullMatch[2], 10);
    endMonthName = fullMatch[3];
    endYear = Number.parseInt(fullMatch[4], 10);
  } else if (sameYearMatch) {
    startMonthName = sameYearMatch[1];
    endMonthName = sameYearMatch[2];
    startYear = Number.parseInt(sameYearMatch[3], 10);
    endYear = startYear;
  } else {
    return null;
  }

  const startMonth = MONTH_NAME_TO_NUMBER[startMonthName.toLowerCase()];
  const endMonth = MONTH_NAME_TO_NUMBER[endMonthName.toLowerCase()];
  if (!startMonth || !endMonth) return null;

  const start = Temporal.PlainDate.from({ year: startYear, month: startMonth, day: 1 });
  const endMonthStart = Temporal.PlainDate.from({ year: endYear, month: endMonth, day: 1 });
  const endExclusive = endMonthStart.add({ months: 1 });
  const endInclusive = endExclusive.subtract({ days: 1 });

  const startDate = start.toString();
  const endDateInclusive = endInclusive.toString();
  const endDateExclusive = endExclusive.toString();
  const id = `${start.year}-${String(start.month).padStart(2, '0')}`;

  return {
    id,
    label: formatDateRange({ startDate, endDateInclusive }),
    shortLabel: formatCompactPeriod({ startDate, endDateInclusive }),
    startDate,
    endDateInclusive,
    endDateExclusive,
  };
}

export function tdcvForPeriodStart(startDate: string): PeriodTdcv {
  const date = Temporal.PlainDate.from(startDate);
  if (Temporal.PlainDate.compare(date, Temporal.PlainDate.from('2026-07-01')) >= 0) {
    return { electricitySingleKwh: '2500', electricityMultiKwh: '3400', gasKwh: '9500' };
  }
  if (Temporal.PlainDate.compare(date, Temporal.PlainDate.from('2023-10-01')) >= 0) {
    return { electricitySingleKwh: '2700', electricityMultiKwh: '3900', gasKwh: '11500' };
  }
  if (Temporal.PlainDate.compare(date, Temporal.PlainDate.from('2020-04-01')) >= 0) {
    return { electricitySingleKwh: '2900', electricityMultiKwh: '4200', gasKwh: '12000' };
  }
  return { electricitySingleKwh: '3100', electricityMultiKwh: '4200', gasKwh: '12000' };
}

export function vatForPeriodStart(startDate: string): PeriodVat {
  const date = Temporal.PlainDate.from(startDate);
  const zeroVatStart = Temporal.PlainDate.from('2026-10-01');
  const zeroVatEndExclusive = Temporal.PlainDate.from('2027-07-01');
  const electricityZeroRated =
    Temporal.PlainDate.compare(date, zeroVatStart) >= 0 &&
    Temporal.PlainDate.compare(date, zeroVatEndExclusive) < 0;

  return {
    electricityRate: electricityZeroRated ? '0' : '0.05',
    gasRate: '0.05',
  };
}

function isDecimalNumberText(value: string): boolean {
  return /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value.trim());
}

function indexRowsByKey(rows: SheetRows): Map<string, Map<string, string>> {
  const keyed = new Map<string, Map<string, string>>();
  for (const rowCells of rows.values()) {
    const keyCell = rowCells.get('A');
    if (!keyCell) continue;
    const key = keyCell.value.trim();
    if (!key) continue;
    const values = new Map<string, string>();
    for (const [col, cell] of rowCells.entries()) {
      values.set(col, cell.value.trim());
    }
    keyed.set(key, values);
  }
  return keyed;
}

function deriveFuelRates(params: {
  nilExclVat: DecimalValue;
  benchmarkExclVat: DecimalValue;
  vatRate: DecimalValue;
  tdcvKwh: DecimalValue;
}): FuelRates {
  const vatMultiplier = decimal(1).plus(params.vatRate);
  const nilIncVat = params.nilExclVat.times(vatMultiplier);
  const benchmarkIncVat = params.benchmarkExclVat.times(vatMultiplier);
  const standingChargePence = nilIncVat.div(DAYS_PER_YEAR).times(PENCE_PER_POUND);
  const unitRatePence = benchmarkIncVat.minus(nilIncVat).div(params.tdcvKwh).times(PENCE_PER_POUND);

  return {
    unitRatePence: fixed({ value: unitRatePence, places: 4 }),
    standingChargePence: fixed({ value: standingChargePence, places: 4 }),
    annualBillPounds: fixed({ value: benchmarkIncVat, places: 4 }),
    nilAnnualPounds: fixed({ value: nilIncVat, places: 4 }),
  };
}

function buildRegionalMapForSheet(params: {
  keyedRows: Map<string, Map<string, string>>;
  keyToken: string;
  col: string;
  tdcv: PeriodTdcv;
  vat: PeriodVat;
}): Record<RegionId, RegionalRates> {
  const elecVat = decimal(params.vat.electricityRate);
  const gasVat = decimal(params.vat.gasRate);
  const elecTdcv = decimal(params.tdcv.electricitySingleKwh);
  const gasTdcv = decimal(params.tdcv.gasKwh);

  let elecNilSum = decimal(0);
  let elecBenchSum = decimal(0);
  let gasNilSum = decimal(0);
  let gasBenchSum = decimal(0);

  const entries = new Map<RegionId, RegionalRates>();

  for (const region of REGIONAL_IDS) {
    const elecNilKey = `ElecSingle_${params.keyToken}_Nil_${region.ofgemLabel}`;
    const elecBenchKey = `ElecSingle_${params.keyToken}_Benchmark_${region.ofgemLabel}`;
    const gasNilKey = `Gas_${params.keyToken}_Nil_${region.ofgemLabel}`;
    const gasBenchKey = `Gas_${params.keyToken}_Benchmark_${region.ofgemLabel}`;

    const elecNilRaw = params.keyedRows.get(elecNilKey)?.get(params.col);
    const elecBenchRaw = params.keyedRows.get(elecBenchKey)?.get(params.col);
    const gasNilRaw = params.keyedRows.get(gasNilKey)?.get(params.col);
    const gasBenchRaw = params.keyedRows.get(gasBenchKey)?.get(params.col);

    if (
      !elecNilRaw ||
      !elecBenchRaw ||
      !gasNilRaw ||
      !gasBenchRaw ||
      !isDecimalNumberText(elecNilRaw) ||
      !isDecimalNumberText(elecBenchRaw) ||
      !isDecimalNumberText(gasNilRaw) ||
      !isDecimalNumberText(gasBenchRaw)
    ) {
      throw new Error(
        `Missing or invalid regional Annex 9 data for ${region.ofgemLabel} (${params.keyToken}, column ${params.col}).`,
      );
    }

    const elecNil = decimal(elecNilRaw);
    const elecBench = decimal(elecBenchRaw);
    const gasNil = decimal(gasNilRaw);
    const gasBench = decimal(gasBenchRaw);

    elecNilSum = elecNilSum.plus(elecNil);
    elecBenchSum = elecBenchSum.plus(elecBench);
    gasNilSum = gasNilSum.plus(gasNil);
    gasBenchSum = gasBenchSum.plus(gasBench);

    const electricity = deriveFuelRates({
      nilExclVat: elecNil,
      benchmarkExclVat: elecBench,
      vatRate: elecVat,
      tdcvKwh: elecTdcv,
    });
    const gas = deriveFuelRates({
      nilExclVat: gasNil,
      benchmarkExclVat: gasBench,
      vatRate: gasVat,
      tdcvKwh: gasTdcv,
    });
    const dualFuelAnnual = decimal(electricity.annualBillPounds).plus(gas.annualBillPounds);

    entries.set(region.id, {
      electricity,
      gas,
      dualFuelAnnualPounds: fixed({ value: dualFuelAnnual, places: 4 }),
    });
  }

  const regionCount = decimal(REGIONAL_IDS.length);
  const gbElectricity = deriveFuelRates({
    nilExclVat: elecNilSum.div(regionCount),
    benchmarkExclVat: elecBenchSum.div(regionCount),
    vatRate: elecVat,
    tdcvKwh: elecTdcv,
  });
  const gbGas = deriveFuelRates({
    nilExclVat: gasNilSum.div(regionCount),
    benchmarkExclVat: gasBenchSum.div(regionCount),
    vatRate: gasVat,
    tdcvKwh: gasTdcv,
  });
  const gbDualFuel = decimal(gbElectricity.annualBillPounds).plus(gbGas.annualBillPounds);

  entries.set('gb-average', {
    electricity: gbElectricity,
    gas: gbGas,
    dualFuelAnnualPounds: fixed({ value: gbDualFuel, places: 4 }),
  });

  const requireRegion = (regionId: RegionId): RegionalRates => {
    const found = entries.get(regionId);
    if (!found) {
      throw new Error(`Missing derived rates for region ${regionId}.`);
    }
    return found;
  };

  return {
    'gb-average': requireRegion('gb-average'),
    'north-west': requireRegion('north-west'),
    northern: requireRegion('northern'),
    yorkshire: requireRegion('yorkshire'),
    'northern-scotland': requireRegion('northern-scotland'),
    southern: requireRegion('southern'),
    'southern-scotland': requireRegion('southern-scotland'),
    'north-wales-and-mersey': requireRegion('north-wales-and-mersey'),
    london: requireRegion('london'),
    'south-east': requireRegion('south-east'),
    eastern: requireRegion('eastern'),
    'east-midlands': requireRegion('east-midlands'),
    midlands: requireRegion('midlands'),
    'south-west': requireRegion('south-west'),
    'south-wales': requireRegion('south-wales'),
  };
}

function verifyWorkbookVatAndHeadline(params: {
  outputSheet: SheetRows;
  activePeriod: CapPeriod;
}): void {
  const exclRow = params.outputSheet.get(28);
  const incRow = params.outputSheet.get(29);
  if (!exclRow || !incRow) return;

  const elecExclRaw = exclRow.get('D')?.value;
  const elecIncRaw = incRow.get('D')?.value;
  const gasExclRaw = exclRow.get('H')?.value;
  const gasIncRaw = incRow.get('H')?.value;
  const dualIncRaw = incRow.get('J')?.value;

  if (
    !elecExclRaw ||
    !elecIncRaw ||
    !gasExclRaw ||
    !gasIncRaw ||
    !dualIncRaw ||
    !isDecimalNumberText(elecExclRaw) ||
    !isDecimalNumberText(elecIncRaw) ||
    !isDecimalNumberText(gasExclRaw) ||
    !isDecimalNumberText(gasIncRaw) ||
    !isDecimalNumberText(dualIncRaw)
  ) {
    return;
  }

  const actualElecVat = decimal(elecIncRaw).div(decimal(elecExclRaw)).minus(1);
  const expectedElecVat = decimal(params.activePeriod.vat.electricityRate);
  if (actualElecVat.minus(expectedElecVat).abs().gt(VAT_RATE_TOLERANCE)) {
    throw new Error(
      `Annex 9 electricity VAT mismatch for ${params.activePeriod.id}: workbook implies ${fixed({ value: actualElecVat, places: 4 })}, expected ${params.activePeriod.vat.electricityRate}.`,
    );
  }

  const actualGasVat = decimal(gasIncRaw).div(decimal(gasExclRaw)).minus(1);
  const expectedGasVat = decimal(params.activePeriod.vat.gasRate);
  if (actualGasVat.minus(expectedGasVat).abs().gt(VAT_RATE_TOLERANCE)) {
    throw new Error(
      `Annex 9 gas VAT mismatch for ${params.activePeriod.id}: workbook implies ${fixed({ value: actualGasVat, places: 4 })}, expected ${params.activePeriod.vat.gasRate}.`,
    );
  }

  const derivedDual = decimal(
    params.activePeriod.rates['direct-debit']['gb-average'].dualFuelAnnualPounds,
  );
  const sheetDual = decimal(dualIncRaw);
  if (derivedDual.minus(sheetDual).abs().gt(HEADLINE_BILL_TOLERANCE)) {
    throw new Error(
      `Annex 9 GB average headline mismatch for ${params.activePeriod.id}: derived ${fixed({ value: derivedDual, places: 2 })}, workbook 1a!J29 is ${fixed({ value: sheetDual, places: 2 })}.`,
    );
  }
}

function verifyWorkbookTdcv(params: { workbook: WorkbookArchive; latestPeriod: CapPeriod }): void {
  const sheetName = '1c Consumption adjusted levels';
  if (!params.workbook.sheetNames.includes(sheetName)) return;

  const sheet = params.workbook.readSheet(sheetName);
  const elecMwhRaw = sheet.get(7)?.get('C')?.value;
  const gasMwhRaw = sheet.get(9)?.get('C')?.value;
  if (
    !elecMwhRaw ||
    !gasMwhRaw ||
    !isDecimalNumberText(elecMwhRaw) ||
    !isDecimalNumberText(gasMwhRaw)
  ) {
    return;
  }

  const sheetElecKwh = decimal(elecMwhRaw).times(KWH_PER_MWH);
  const sheetGasKwh = decimal(gasMwhRaw).times(KWH_PER_MWH);
  const expectedElecKwh = decimal(params.latestPeriod.tdcv.electricitySingleKwh);
  const expectedGasKwh = decimal(params.latestPeriod.tdcv.gasKwh);

  if (!sheetElecKwh.eq(expectedElecKwh) || !sheetGasKwh.eq(expectedGasKwh)) {
    throw new Error(
      `Annex 9 TDCV mismatch for ${params.latestPeriod.id}: workbook reports ${sheetElecKwh.toString()}/${sheetGasKwh.toString()} kWh, expected ${params.latestPeriod.tdcv.electricitySingleKwh}/${params.latestPeriod.tdcv.gasKwh} kWh.`,
    );
  }
}

export function parseAnnex9Workbook(params: {
  bytes: Uint8Array;
  indexUrl: string;
  workbookUrl: string;
  workbookFilename: string;
  generatedAt: string;
}): PriceCapDataset {
  const workbook = openXlsxWorkbook(params.bytes);
  const outputSheet = workbook.readSheet('1a Levelised DTC');
  const activeHeadingRaw = outputSheet.get(6)?.get('C')?.value.trim() ?? '';
  let activeParsed: Omit<ParsedPeriodHeader, 'col'> | null = null;
  if (activeHeadingRaw) {
    activeParsed = parseOfgemPeriodHeading(activeHeadingRaw);
    if (!activeParsed) {
      throw new Error(
        `Could not parse active period heading in "1a Levelised DTC"!C6: "${activeHeadingRaw}".`,
      );
    }
  }

  const sheetMaps = new Map<PaymentMethodId, Map<string, Map<string, string>>>();
  const headerRows = new Map<PaymentMethodId, Map<string, { value: string }>>();

  for (const sheetDef of PAYMENT_SHEETS) {
    const sheetRows = workbook.readSheet(sheetDef.sheetName);
    const headerRow = sheetRows.get(9);
    if (!headerRow) {
      throw new Error(`Annex 9 sheet "${sheetDef.sheetName}" is missing period header row 9.`);
    }
    headerRows.set(sheetDef.paymentMethod, headerRow);
    sheetMaps.set(sheetDef.paymentMethod, indexRowsByKey(sheetRows));
  }

  const primaryHeaderRow = headerRows.get('direct-debit');
  const scHeaderRow = headerRows.get('standard-credit');
  const ppmHeaderRow = headerRows.get('prepayment');
  const directDebitRows = sheetMaps.get('direct-debit');
  const standardCreditRows = sheetMaps.get('standard-credit');
  const prepaymentRows = sheetMaps.get('prepayment');
  if (
    !primaryHeaderRow ||
    !scHeaderRow ||
    !ppmHeaderRow ||
    !directDebitRows ||
    !standardCreditRows ||
    !prepaymentRows
  ) {
    throw new Error('Failed to load payment method sheets from Annex 9 workbook.');
  }

  const probeRow = directDebitRows.get('ElecSingle_Other_Benchmark_North West');
  if (!probeRow) {
    throw new Error('Annex 9 sheet "2a Historical_Other" is missing expected benchmark rows.');
  }

  const minimumColIndex = columnLettersToIndex('R');
  const periodHeaders: ParsedPeriodHeader[] = [];

  for (const [col, cell] of primaryHeaderRow.entries()) {
    if (columnLettersToIndex(col) < minimumColIndex) continue;
    const probeValue = probeRow.get(col);
    if (!probeValue || !isDecimalNumberText(probeValue)) continue;
    const parsed = parseOfgemPeriodHeading(cell.value);
    if (!parsed) {
      throw new Error(
        `Unparseable populated period heading "${cell.value}" in "2a Historical_Other" column ${col}.`,
      );
    }
    if (
      Temporal.PlainDate.compare(
        Temporal.PlainDate.from(parsed.startDate),
        Temporal.PlainDate.from('2019-01-01'),
      ) < 0
    ) {
      continue;
    }

    const scHeading = scHeaderRow.get(col)?.value ?? '';
    const ppmHeading = ppmHeaderRow.get(col)?.value ?? '';
    const scParsed = parseOfgemPeriodHeading(scHeading);
    const ppmParsed = parseOfgemPeriodHeading(ppmHeading);
    if (!scParsed || scParsed.id !== parsed.id) {
      throw new Error(
        `Column ${col} period mismatch in "2b Historical_SC": found "${scHeading}", expected ${parsed.id}.`,
      );
    }
    if (!ppmParsed || ppmParsed.id !== parsed.id) {
      throw new Error(
        `Column ${col} period mismatch in "2c Historical_PPM": found "${ppmHeading}", expected ${parsed.id}.`,
      );
    }

    periodHeaders.push({ col, ...parsed });
  }

  periodHeaders.sort((left, right) =>
    Temporal.PlainDate.compare(
      Temporal.PlainDate.from(left.startDate),
      Temporal.PlainDate.from(right.startDate),
    ),
  );

  if (periodHeaders.length === 0) {
    throw new Error('No populated Ofgem price cap periods found in Annex 9 workbook.');
  }

  const periods: CapPeriod[] = periodHeaders.map((header) => {
    const tdcv = tdcvForPeriodStart(header.startDate);
    const vat = vatForPeriodStart(header.startDate);

    return {
      id: header.id,
      label: header.label,
      shortLabel: header.shortLabel,
      startDate: header.startDate,
      endDateInclusive: header.endDateInclusive,
      endDateExclusive: header.endDateExclusive,
      tdcv,
      vat,
      rates: {
        'direct-debit': buildRegionalMapForSheet({
          keyedRows: directDebitRows,
          keyToken: 'Other',
          col: header.col,
          tdcv,
          vat,
        }),
        'standard-credit': buildRegionalMapForSheet({
          keyedRows: standardCreditRows,
          keyToken: 'SC',
          col: header.col,
          tdcv,
          vat,
        }),
        prepayment: buildRegionalMapForSheet({
          keyedRows: prepaymentRows,
          keyToken: 'PPM',
          col: header.col,
          tdcv,
          vat,
        }),
      },
    };
  });

  const latestPeriod = periods[periods.length - 1];
  const latestAnnouncedPeriodId = activeParsed?.id ?? latestPeriod.id;
  const activePeriod =
    periods.find((period) => period.id === latestAnnouncedPeriodId) ?? latestPeriod;

  verifyWorkbookVatAndHeadline({ outputSheet, activePeriod });
  verifyWorkbookTdcv({ workbook, latestPeriod });

  return parsePriceCapDataset({
    schemaVersion: 1,
    generatedAt: params.generatedAt,
    source: {
      indexUrl: params.indexUrl,
      workbookUrl: params.workbookUrl,
      workbookFilename: params.workbookFilename,
      latestAnnouncedPeriodId,
    },
    periods,
  });
}
