import type { Task } from '@/types/database';

const vndFormatter = new Intl.NumberFormat('vi-VN');

export function cents(value: string | number | null | undefined): bigint {
  const input = String(value ?? '0');
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(input);
  if (!match) throw new Error(`Invalid money: ${input}`);
  return (match[1] === '-' ? -1n : 1n) * (BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0')));
}
export function money(value: string | number | bigint | null | undefined) {
  const amount = typeof value === 'bigint' ? value : cents(value);
  const sign = amount < 0n ? '-' : '';
  const abs = amount < 0n ? -amount : amount;
  const whole = abs / 100n;
  const fraction = abs % 100n;
  return `${sign}${vndFormatter.format(whole)}${fraction ? `,${fraction.toString().padStart(2,'0')}` : ''} ₫`;
}
export function monthBounds(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error('Invalid month');
  const [year, month] = value.split('-').map(Number);
  if (month < 1 || month > 12) throw new Error('Invalid month');
  const start = `${value}-01`;
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { start, end };
}
export function projectProgress(tasks: Pick<Task,'status'>[]) {
  const included = tasks.filter(task => task.status !== 'cancelled');
  return included.length ? Math.round(included.filter(task => task.status === 'done').length / included.length * 100) : 0;
}
export function overdue(task: Pick<Task,'status'|'due_date'>, today: string) {
  return !!task.due_date && task.due_date < today && task.status !== 'done' && task.status !== 'cancelled';
}
