export type PaymentMethodId = 'direct-debit' | 'prepayment' | 'standard-credit';

export type RegionId =
  | 'gb-average'
  | 'north-west'
  | 'northern'
  | 'yorkshire'
  | 'northern-scotland'
  | 'southern'
  | 'southern-scotland'
  | 'north-wales-and-mersey'
  | 'london'
  | 'south-east'
  | 'eastern'
  | 'east-midlands'
  | 'midlands'
  | 'south-west'
  | 'south-wales';

export interface RegionMeta {
  id: RegionId;
  name: string;
  shortName: string;
  ofgemLabel: string;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  'direct-debit': 'Direct Debit',
  prepayment: 'Prepayment meter',
  'standard-credit': 'Standard credit',
};

export const PAYMENT_METHODS: ReadonlyArray<PaymentMethodId> = [
  'direct-debit',
  'prepayment',
  'standard-credit',
];

export const REGIONS: ReadonlyArray<RegionMeta> = [
  {
    id: 'gb-average',
    name: 'Great Britain average',
    shortName: 'GB average',
    ofgemLabel: 'GB average',
  },
  { id: 'eastern', name: 'Eastern England', shortName: 'Eastern', ofgemLabel: 'Eastern' },
  {
    id: 'east-midlands',
    name: 'East Midlands',
    shortName: 'East Midlands',
    ofgemLabel: 'East Midlands',
  },
  { id: 'london', name: 'London', shortName: 'London', ofgemLabel: 'London' },
  { id: 'midlands', name: 'Midlands', shortName: 'Midlands', ofgemLabel: 'Midlands' },
  {
    id: 'north-wales-and-mersey',
    name: 'North Wales & Merseyside',
    shortName: 'N Wales & Mersey',
    ofgemLabel: 'N Wales and Mersey',
  },
  {
    id: 'north-west',
    name: 'North West England',
    shortName: 'North West',
    ofgemLabel: 'North West',
  },
  { id: 'northern', name: 'North East England', shortName: 'Northern', ofgemLabel: 'Northern' },
  {
    id: 'northern-scotland',
    name: 'Northern Scotland',
    shortName: 'N Scotland',
    ofgemLabel: 'Northern Scotland',
  },
  {
    id: 'south-east',
    name: 'South East England',
    shortName: 'South East',
    ofgemLabel: 'South East',
  },
  { id: 'south-wales', name: 'South Wales', shortName: 'South Wales', ofgemLabel: 'South Wales' },
  {
    id: 'south-west',
    name: 'South West England',
    shortName: 'South West',
    ofgemLabel: 'Southern Western',
  },
  { id: 'southern', name: 'Southern England', shortName: 'Southern', ofgemLabel: 'Southern' },
  {
    id: 'southern-scotland',
    name: 'Southern Scotland',
    shortName: 'S Scotland',
    ofgemLabel: 'Southern Scotland',
  },
  { id: 'yorkshire', name: 'Yorkshire', shortName: 'Yorkshire', ofgemLabel: 'Yorkshire' },
];

export interface FuelRates {
  unitRatePence: string;
  standingChargePence: string;
  annualBillPounds: string;
  nilAnnualPounds: string;
}

export interface RegionalRates {
  electricity: FuelRates;
  gas: FuelRates;
  dualFuelAnnualPounds: string;
}

export interface PeriodTdcv {
  electricitySingleKwh: string;
  electricityMultiKwh: string;
  gasKwh: string;
}

export interface PeriodVat {
  electricityRate: string;
  gasRate: string;
}

export interface CapPeriod {
  id: string;
  label: string;
  shortLabel: string;
  startDate: string;
  endDateInclusive: string;
  endDateExclusive: string;
  tdcv: PeriodTdcv;
  vat: PeriodVat;
  rates: Record<PaymentMethodId, Record<RegionId, RegionalRates>>;
}

export interface PriceCapSource {
  indexUrl: string;
  workbookUrl: string;
  workbookFilename: string;
  latestAnnouncedPeriodId: string;
}

export interface PriceCapDataset {
  schemaVersion: number;
  generatedAt: string;
  source: PriceCapSource;
  periods: CapPeriod[];
}

export type DatasetErrorCause = 'network' | 'http' | 'invalid-data' | 'empty-dataset';

export type PeriodStatus = 'current' | 'upcoming' | 'past';
