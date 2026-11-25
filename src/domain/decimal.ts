import DecimalBase from 'decimal.js-light';

export const Decimal = DecimalBase.clone({
  precision: 40,
  rounding: DecimalBase.ROUND_HALF_UP,
});

export type DecimalValue = DecimalBase;
export type NumericInput = number | string | DecimalBase;

export function decimal(value: NumericInput): DecimalValue {
  return new Decimal(value);
}

export function fixed(params: { value: NumericInput; places: number }): string {
  return decimal(params.value).toFixed(params.places, Decimal.ROUND_HALF_UP);
}

export function formatPounds(params: { value: NumericInput; places?: number }): string {
  const places = params.places ?? 0;
  const rounded = decimal(params.value).toFixed(places, Decimal.ROUND_HALF_UP);
  const negative = rounded.startsWith('-');
  const unsigned = negative ? rounded.slice(1) : rounded;
  const [integerPart, fractionPart] = unsigned.split('.');
  const grouped = BigInt(integerPart).toLocaleString('en-GB');
  const sign = negative ? '-' : '';
  return fractionPart ? `${sign}£${grouped}.${fractionPart}` : `${sign}£${grouped}`;
}

export function formatSignedPounds(params: { value: NumericInput; places?: number }): string {
  const amount = decimal(params.value);
  const formatted = formatPounds({ value: amount.abs(), places: params.places });
  if (amount.gt(0)) return `+${formatted}`;
  if (amount.lt(0)) return `-${formatted}`;
  return formatted;
}

export function formatPence(params: { value: NumericInput; places?: number }): string {
  const places = params.places ?? 2;
  return `${decimal(params.value).toFixed(places, Decimal.ROUND_HALF_UP)}p`;
}

export function formatSignedPence(params: { value: NumericInput; places?: number }): string {
  const places = params.places ?? 2;
  const rounded = decimal(decimal(params.value).toFixed(places, Decimal.ROUND_HALF_UP));
  const formatted = formatPence({ value: rounded.abs(), places });
  if (rounded.gt(0)) return `+${formatted}`;
  if (rounded.lt(0)) return `-${formatted}`;
  return formatted;
}

export function formatPercentChange(params: { value: NumericInput; places?: number }): string {
  const places = params.places ?? 0;
  const amount = decimal(params.value);
  const rounded = amount.abs().toFixed(places, Decimal.ROUND_HALF_UP);
  if (decimal(rounded).eq(0)) return `${rounded}%`;
  if (amount.gt(0)) return `+${rounded}%`;
  if (amount.lt(0)) return `-${rounded}%`;
  return `${rounded}%`;
}

export function formatCompactPercentChange(params: { value: NumericInput }): string {
  const amount = decimal(params.value);
  const magnitude = amount.abs();
  if (magnitude.eq(0)) return '0%';
  if (magnitude.gte('0.95')) return formatPercentChange({ value: amount, places: 0 });
  if (magnitude.gte('0.05')) return formatPercentChange({ value: amount, places: 1 });
  const twoPlace = formatPercentChange({ value: amount, places: 2 });
  return twoPlace === '0.00%' ? '0%' : twoPlace;
}

export function percentageChange(params: {
  current: NumericInput;
  previous: NumericInput;
}): DecimalValue | null {
  const previousValue = decimal(params.previous);
  if (previousValue.eq(0)) return null;
  return decimal(params.current).minus(previousValue).div(previousValue).times(100);
}
