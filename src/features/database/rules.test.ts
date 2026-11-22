import { describe, expect, it } from 'vitest';
import { applyRules, validateRules, type DataRow } from './rules';

const props = [
  { property_key: 'title', property_type: 'title' as const },
  { property_key: 'amount', property_type: 'currency' as const },
  { property_key: 'status', property_type: 'status' as const },
  { property_key: 'due_date', property_type: 'date' as const },
  { property_key: 'tags', property_type: 'multi_select' as const },
];

const rows: DataRow[] = [
  { id: '1', title: 'Ăn uống', amount: 150000, status: 'todo', due_date: '2026-11-10', tags: ['t1'] },
  { id: '2', title: 'Cà phê sáng', amount: 50000, status: 'done', due_date: '2026-11-20', tags: ['t1', 't2'] },
  { id: '3', title: 'Tiền nhà', amount: 7500000, status: 'in_progress', due_date: null, tags: [] },
];

describe('database filter, sort and validation rules', () => {
  it('supports AND / OR filtering across operators', () => {
    expect(
      applyRules(rows, { logic: 'and', rules: [{ key: 'amount', operator: 'greater_than', value: 100000 }, { key: 'status', operator: 'is_not', value: 'in_progress' }] }, []).map(r => r.id)
    ).toEqual(['1']);

    expect(
      applyRules(rows, { logic: 'or', rules: [{ key: 'due_date', operator: 'is_empty' }, { key: 'tags', operator: 'is', value: 't2' }] }, []).map(r => r.id)
    ).toEqual(['2', '3']);
  });

  it('supports date before/after/between and numeric between', () => {
    expect(applyRules(rows, { logic: 'and', rules: [{ key: 'due_date', operator: 'before', value: '2026-11-15' }] }, []).map(r => r.id)).toEqual(['1']);
    expect(applyRules(rows, { logic: 'and', rules: [{ key: 'due_date', operator: 'after', value: '2026-11-15' }] }, []).map(r => r.id)).toEqual(['2']);
    expect(applyRules(rows, { logic: 'and', rules: [{ key: 'due_date', operator: 'between', value: '2026-11-01', value2: '2026-11-30' }] }, []).map(r => r.id)).toEqual(['1', '2']);
    expect(applyRules(rows, { logic: 'and', rules: [{ key: 'amount', operator: 'between', value: 40000, value2: 200000 }] }, []).map(r => r.id)).toEqual(['1', '2']);
  });

  it('supports Vietnamese text search and multi-rule sorting', () => {
    expect(applyRules(rows, { logic: 'and', rules: [{ key: 'title', operator: 'contains', value: 'cà phê' }] }, []).map(r => r.id)).toEqual(['2']);
    expect(applyRules(rows, { logic: 'and', rules: [] }, [{ key: 'amount', desc: true }]).map(r => r.id)).toEqual(['3', '1', '2']);
  });

  it('validates server-side rules and rejects incompatible operators or unknown keys', () => {
    expect(() => validateRules({ logic: 'and', rules: [{ key: 'nonexistent', operator: 'is', value: 'x' }] }, [], null, props)).toThrow();
    expect(() => validateRules({ logic: 'and', rules: [{ key: 'title', operator: 'before', value: '2026-11-01' }] }, [], null, props)).toThrow();
    expect(() => validateRules({ logic: 'and', rules: [{ key: 'status', operator: 'greater_than', value: 10 }] }, [], null, props)).toThrow();
    expect(() => validateRules({ logic: 'and', rules: [] }, [{ key: 'bad', desc: false }], null, props)).toThrow();
    expect(() => validateRules({ logic: 'and', rules: [] }, [], 'bad', props)).toThrow();
  });
});
