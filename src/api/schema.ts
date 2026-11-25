import { z } from 'zod';
import type {
  CapPeriod,
  FuelRates,
  PaymentMethodId,
  PriceCapDataset,
  RegionId,
  RegionalRates,
} from '../domain/types';

z.config({ jitless: true });

const decimalStringSchema = z.string().regex(/^-?\d+(?:\.\d+)?$/, 'Expected decimal string');
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

const fuelRatesSchema: z.ZodType<FuelRates> = z.object({
  unitRatePence: decimalStringSchema,
  standingChargePence: decimalStringSchema,
  annualBillPounds: decimalStringSchema,
  nilAnnualPounds: decimalStringSchema,
});

const regionalRatesSchema: z.ZodType<RegionalRates> = z.object({
  electricity: fuelRatesSchema,
  gas: fuelRatesSchema,
  dualFuelAnnualPounds: decimalStringSchema,
});

const regionRatesMapSchema: z.ZodType<Record<RegionId, RegionalRates>> = z.object({
  'gb-average': regionalRatesSchema,
  'north-west': regionalRatesSchema,
  northern: regionalRatesSchema,
  yorkshire: regionalRatesSchema,
  'northern-scotland': regionalRatesSchema,
  southern: regionalRatesSchema,
  'southern-scotland': regionalRatesSchema,
  'north-wales-and-mersey': regionalRatesSchema,
  london: regionalRatesSchema,
  'south-east': regionalRatesSchema,
  eastern: regionalRatesSchema,
  'east-midlands': regionalRatesSchema,
  midlands: regionalRatesSchema,
  'south-west': regionalRatesSchema,
  'south-wales': regionalRatesSchema,
});

const paymentMethodRatesSchema: z.ZodType<
  Record<PaymentMethodId, Record<RegionId, RegionalRates>>
> = z.object({
  'direct-debit': regionRatesMapSchema,
  prepayment: regionRatesMapSchema,
  'standard-credit': regionRatesMapSchema,
});

const capPeriodSchema: z.ZodType<CapPeriod> = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  startDate: isoDateSchema,
  endDateInclusive: isoDateSchema,
  endDateExclusive: isoDateSchema,
  tdcv: z.object({
    electricitySingleKwh: decimalStringSchema,
    electricityMultiKwh: decimalStringSchema,
    gasKwh: decimalStringSchema,
  }),
  vat: z.object({
    electricityRate: decimalStringSchema,
    gasRate: decimalStringSchema,
  }),
  rates: paymentMethodRatesSchema,
});

export const priceCapDatasetSchema: z.ZodType<PriceCapDataset> = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().min(1),
  source: z.object({
    indexUrl: z.string().url(),
    workbookUrl: z.string().url(),
    workbookFilename: z.string().min(1),
    latestAnnouncedPeriodId: z.string().min(1),
  }),
  periods: z.array(capPeriodSchema).min(1),
});

export function parsePriceCapDataset(input: unknown): PriceCapDataset {
  return priceCapDatasetSchema.parse(input);
}
