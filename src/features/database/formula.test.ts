import { describe, expect, it } from 'vitest';
import { evaluateFormula, validateFormula } from './formula';
import type { DataRow } from './rules';

describe('custom formula engine', () => {
  const row: DataRow = {
    id: '1',
    name: 'Dự án Alpha',
    budget_amount: 10000000,
    actual_spending: 3500000,
    progress: 75,
    custom_properties: { custom_tax: 0.1 },
  };

  it('evaluates arithmetic expressions and property references accurately', () => {
    expect(evaluateFormula('{budget_amount} - {actual_spending}', row)).toBe(6500000);
    expect(evaluateFormula('round({actual_spending} / {budget_amount} * 100, 1)', row)).toBe(35);
    expect(evaluateFormula('{actual_spending} * (1 + {custom_tax})', row)).toBe(3850000);
  });

  it('evaluates conditional and string functions', () => {
    expect(evaluateFormula('if({actual_spending} > {budget_amount}, "Vượt", "Trong hạn mức")', row)).toBe('Trong hạn mức');
    expect(evaluateFormula('concat({name}, " - ", {progress}, "%")', row)).toBe('Dự án Alpha - 75%');
    expect(evaluateFormula('coalesce({missing}, {budget_amount})', row)).toBe(10000000);
    expect(evaluateFormula('abs(-42) + min(10, 3) + max(2, 5)', row)).toBe(50);
  });

  it('handles division by zero safely without throwing', () => {
    expect(evaluateFormula('{budget_amount} / 0', row)).toBeNull();
  });

  it('validates allowed keys and rejects unknown keys or unsafe syntax', () => {
    expect(validateFormula('{budget_amount} - {actual_spending}', ['budget_amount', 'actual_spending']).refs).toEqual([
      'budget_amount',
      'actual_spending',
    ]);
    expect(() => validateFormula('{unknown_key} + 1', ['budget_amount'])).toThrow(/không tồn tại/);
    expect(() => validateFormula('eval("1+1")', ['budget_amount'])).toThrow(/không được hỗ trợ/);
    expect(() => validateFormula('', ['budget_amount'])).toThrow(/trống/);
  });
});
