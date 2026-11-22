import { z } from 'zod';
import type { DatabaseProperty } from '@/types/database';

export const operatorSchema = z.enum([
  'is',
  'is_not',
  'contains',
  'does_not_contain',
  'is_empty',
  'is_not_empty',
  'greater_than',
  'less_than',
  'before',
  'after',
  'between',
]);
export const filterSchema = z.object({
  logic: z.enum(['and', 'or']),
  rules: z
    .array(
      z.object({
        key: z.string().max(64),
        operator: operatorSchema,
        value: z.union([z.string(), z.number(), z.boolean()]).nullable().optional(),
        value2: z.union([z.string(), z.number()]).nullable().optional(),
      })
    )
    .max(20),
});
export const sortsSchema = z.array(z.object({ key: z.string().max(64), desc: z.boolean() })).max(8);
export type FilterSet = z.infer<typeof filterSchema>;
export type SortRule = z.infer<typeof sortsSchema>[number];
export type DataRow = Record<string, unknown> & { id: string };

export function propertyValue(row: Record<string, unknown>, key: string): unknown {
  if (key in row) return row[key];
  const custom = row.custom_properties;
  return custom && typeof custom === 'object' && !Array.isArray(custom)
    ? (custom as Record<string, unknown>)[key]
    : undefined;
}

export function validateRules(
  filters: FilterSet,
  sorts: SortRule[],
  groupBy: string | null,
  properties: Pick<DatabaseProperty, 'property_key' | 'property_type'>[]
) {
  const keys = new Map(properties.map(p => [p.property_key, p.property_type]));
  for (const rule of filters.rules) {
    const type = keys.get(rule.key);
    if (!type) throw new Error(`Thuộc tính không hợp lệ: ${rule.key}`);
    if (
      ['greater_than', 'less_than'].includes(rule.operator) &&
      !['number', 'currency', 'formula', 'date', 'created_time', 'last_edited_time'].includes(type)
    ) {
      throw new Error('Bộ lọc số không phù hợp với thuộc tính');
    }
    if (
      ['before', 'after'].includes(rule.operator) &&
      !['date', 'created_time', 'last_edited_time'].includes(type)
    ) {
      throw new Error('Bộ lọc ngày không phù hợp với thuộc tính');
    }
    if (
      rule.operator === 'between' &&
      !['number', 'currency', 'formula', 'date', 'created_time', 'last_edited_time'].includes(type)
    ) {
      throw new Error('Bộ lọc khoảng giá trị không phù hợp với thuộc tính');
    }
  }
  for (const sort of sorts) {
    if (!keys.has(sort.key)) throw new Error(`Thuộc tính sắp xếp không hợp lệ: ${sort.key}`);
  }
  if (groupBy && !keys.has(groupBy)) throw new Error('Thuộc tính nhóm không hợp lệ');
}

function compare(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) - Number(b);
  const aStr = String(a);
  const bStr = String(b);
  if (/^-?\d+(\.\d+)?$/.test(aStr) && /^-?\d+(\.\d+)?$/.test(bStr)) {
    return Number(aStr) - Number(bStr);
  }
  return aStr.localeCompare(bStr, 'vi', { numeric: true, sensitivity: 'base' });
}

function isNumericPair(a: unknown, b: unknown) {
  const aStr = String(a ?? '').trim();
  const bStr = String(b ?? '').trim();
  return /^-?\d+(\.\d+)?$/.test(aStr) && /^-?\d+(\.\d+)?$/.test(bStr);
}

function normalizeDateComparable(actual: unknown, expected: unknown): [string, string] {
  const a = String(actual ?? '');
  const e = String(expected ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(e) && /^\d{4}-\d{2}-\d{2}T/.test(a)) {
    return [a.slice(0, 10), e];
  }
  return [a, e];
}

function matches(
  row: DataRow,
  rule: FilterSet['rules'][number],
  resolveDisplay?: (row: DataRow, key: string) => string
) {
  const actual = propertyValue(row, rule.key);
  const empty = actual == null || actual === '' || (Array.isArray(actual) && actual.length === 0);
  if (rule.operator === 'is_empty') return empty;
  if (rule.operator === 'is_not_empty') return !empty;
  const expected = rule.value;
  if (rule.operator === 'is') {
    if (Array.isArray(actual)) return actual.map(String).includes(String(expected ?? ''));
    return String(actual ?? '') === String(expected ?? '');
  }
  if (rule.operator === 'is_not') {
    if (Array.isArray(actual)) return !actual.map(String).includes(String(expected ?? ''));
    return String(actual ?? '') !== String(expected ?? '');
  }
  const rawHay = Array.isArray(actual) ? actual.join(' ') : String(actual ?? '');
  const displayHay = resolveDisplay ? resolveDisplay(row, rule.key) : '';
  const hay = `${rawHay} ${displayHay}`.toLocaleLowerCase('vi');
  const needle = String(expected ?? '').toLocaleLowerCase('vi');
  if (rule.operator === 'contains') return hay.includes(needle);
  if (rule.operator === 'does_not_contain') return !hay.includes(needle);
  if (empty) return false;
  if (rule.operator === 'greater_than') {
    return isNumericPair(actual, expected) ? Number(actual) > Number(expected) : String(actual) > String(expected);
  }
  if (rule.operator === 'less_than') {
    return isNumericPair(actual, expected) ? Number(actual) < Number(expected) : String(actual) < String(expected);
  }
  if (rule.operator === 'before') {
    const [a, e] = normalizeDateComparable(actual, expected);
    return a < e;
  }
  if (rule.operator === 'after') {
    const [a, e] = normalizeDateComparable(actual, expected);
    return a > e;
  }
  if (rule.operator === 'between') {
    if (isNumericPair(actual, expected) && isNumericPair(actual, rule.value2)) {
      const n = Number(actual);
      return n >= Number(expected) && n <= Number(rule.value2);
    }
    const [a1, e1] = normalizeDateComparable(actual, expected);
    const [a2, e2] = normalizeDateComparable(actual, rule.value2 ?? '');
    return a1 >= e1 && a2 <= e2;
  }
  return true;
}

export function applyRules(
  rows: DataRow[],
  filters: FilterSet,
  sorts: SortRule[],
  resolveDisplay?: (row: DataRow, key: string) => string
) {
  const filtered = filters.rules.length
    ? rows.filter(row =>
        filters.logic === 'and'
          ? filters.rules.every(rule => matches(row, rule, resolveDisplay))
          : filters.rules.some(rule => matches(row, rule, resolveDisplay))
      )
    : rows;
  if (!sorts.length) return filtered;
  return [...filtered].sort((a, b) => {
    for (const sort of sorts) {
      const result = compare(propertyValue(a, sort.key), propertyValue(b, sort.key));
      if (result) return sort.desc ? -result : result;
    }
    return 0;
  });
}
