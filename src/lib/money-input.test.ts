import { describe, expect, it } from 'vitest';
import {
  computeFormattedCaret,
  formatMoneyDraft,
  normalizeMoneyValue,
  sanitizeMoneyDraft,
} from './money-input';

describe('money-input helpers', () => {
  it('formats integers with comma thousands separators', () => {
    expect(formatMoneyDraft(sanitizeMoneyDraft('1000'))).toBe('1,000');
    expect(formatMoneyDraft(sanitizeMoneyDraft('100000'))).toBe('100,000');
    expect(formatMoneyDraft(sanitizeMoneyDraft('12500000'))).toBe('12,500,000');
    expect(formatMoneyDraft(sanitizeMoneyDraft('0'))).toBe('0');
  });

  it('preserves in-progress decimals and strips trailing zero decimals when normalizing', () => {
    expect(formatMoneyDraft(sanitizeMoneyDraft('1000.'))).toBe('1,000.');
    expect(formatMoneyDraft(sanitizeMoneyDraft('1000.0'))).toBe('1,000.0');
    expect(formatMoneyDraft(sanitizeMoneyDraft('1000.55'))).toBe('1,000.55');
    expect(formatMoneyDraft(sanitizeMoneyDraft('1000.559'))).toBe('1,000.55');
    expect(normalizeMoneyValue('1,000.')).toBe('1000');
    expect(normalizeMoneyValue('100,000.00')).toBe('100000');
    expect(normalizeMoneyValue('100,000.50')).toBe('100000.50');
    expect(formatMoneyDraft('100000.00', { stripTrailingZeroDecimals: true })).toBe('100,000');
  });

  it('handles negative values only when allowNegative is enabled', () => {
    expect(sanitizeMoneyDraft('-50000', { allowNegative: false })).toBe('50000');
    expect(sanitizeMoneyDraft('-50000', { allowNegative: true })).toBe('-50000');
    expect(formatMoneyDraft(sanitizeMoneyDraft('-2500000', { allowNegative: true }))).toBe('-2,500,000');
    expect(sanitizeMoneyDraft('-', { allowNegative: true })).toBe('-');
    expect(normalizeMoneyValue('-', { allowNegative: true })).toBe('');
    expect(normalizeMoneyValue('-0', { allowNegative: true })).toBe('0');
  });

  it('sanitizes pasted formatted values and leading zeros', () => {
    expect(normalizeMoneyValue('1,250,000 ₫')).toBe('1250000');
    expect(sanitizeMoneyDraft('001234')).toBe('1234');
    expect(sanitizeMoneyDraft('.5')).toBe('0.5');
    expect(sanitizeMoneyDraft('1.2.3')).toBe('1.23');
  });

  it('computes accurate caret positions across inserted commas', () => {
    // Typing '0' at end of '100' -> '1,000'
    expect(computeFormattedCaret('1000', '1,000')).toBe(5);
    // Inserting '5' after '10' in '100,000' -> rawBeforeCaret='105', formatted='1,050,000'
    expect(computeFormattedCaret('105', '1,050,000')).toBe(4);
    // Backspacing middle digit
    expect(computeFormattedCaret('1,2', '12,345')).toBe(2);
  });
});
