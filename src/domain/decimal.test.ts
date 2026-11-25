import { describe, expect, it } from 'vitest';
import {
  decimal,
  fixed,
  formatCompactPercentChange,
  formatPence,
  formatPercentChange,
  formatPounds,
  formatSignedPence,
  formatSignedPounds,
  percentageChange,
} from './decimal';

describe('decimal helpers', () => {
  it('formats pounds with UK thousands grouping and half-up rounding', () => {
    expect(formatPounds({ value: '1723.358' })).toBe('£1,723');
    expect(formatPounds({ value: '2166.5' })).toBe('£2,167');
    expect(formatPounds({ value: '108.215', places: 2 })).toBe('£108.22');
    expect(formatPounds({ value: '-42.4' })).toBe('-£42');
  });

  it('formats signed pounds', () => {
    expect(formatSignedPounds({ value: '443' })).toBe('+£443');
    expect(formatSignedPounds({ value: '-120' })).toBe('-£120');
    expect(formatSignedPounds({ value: '0' })).toBe('£0');
  });

  it('formats pence, signed pence, and fixed strings', () => {
    expect(formatPence({ value: '32.690457' })).toBe('32.69p');
    expect(formatPence({ value: '54.7669' })).toBe('54.77p');
    expect(formatSignedPence({ value: '6.3683' })).toBe('+6.37p');
    expect(formatSignedPence({ value: '-0.0672' })).toBe('-0.07p');
    expect(formatSignedPence({ value: '-0.0012' })).toBe('0.00p');
    expect(formatSignedPence({ value: '0' })).toBe('0.00p');
    expect(fixed({ value: '10.9577', places: 2 })).toBe('10.96');
  });

  it('computes and formats percentage changes', () => {
    const change = percentageChange({ current: '2166.358', previous: '1723.358' });
    expect(change).not.toBeNull();
    expect(formatPercentChange({ value: change ?? decimal(0) })).toBe('+26%');
    expect(formatPercentChange({ value: '-8.4', places: 1 })).toBe('-8.4%');
    expect(formatPercentChange({ value: '-0.12', places: 0 })).toBe('0%');
    expect(formatPercentChange({ value: '0' })).toBe('0%');
    expect(formatCompactPercentChange({ value: '24.19' })).toBe('+24%');
    expect(formatCompactPercentChange({ value: '0.96' })).toBe('+1%');
    expect(formatCompactPercentChange({ value: '-0.1225' })).toBe('-0.1%');
    expect(formatCompactPercentChange({ value: '-0.0493' })).toBe('-0.05%');
    expect(formatCompactPercentChange({ value: '-0.001' })).toBe('0%');
    expect(formatCompactPercentChange({ value: '0' })).toBe('0%');
    expect(percentageChange({ current: '100', previous: '0' })).toBeNull();
  });
});
