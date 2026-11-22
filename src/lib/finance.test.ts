import { describe,it,expect } from 'vitest';
import { cents,money,monthBounds,projectProgress,overdue } from './finance';
import { periodBounds } from '@/features/workspace/queries';
describe('money and dates',()=>{
 it('keeps cents exact for negative and large values',()=>{expect(cents('9999999999999.99')).toBe(999999999999999n);expect(cents('-123.45')).toBe(-12345n);expect(money('15000000')).toBe('15.000.000 ₫');});
 it('crosses year and leap month boundaries',()=>{expect(monthBounds('2026-12')).toEqual({start:'2026-12-01',end:'2027-01-01'});expect(monthBounds('2028-02')).toEqual({start:'2028-02-01',end:'2028-03-01'});expect(periodBounds('last','2026-01-10')).toEqual({start:'2025-12-01',end:'2026-01-01'});});
 it('uses an exclusive end for custom ranges',()=>{expect(periodBounds('custom','2026-11-22',{from:'2026-11-01',to:'2026-11-22'})).toEqual({start:'2026-11-01',end:'2026-11-23'});});
});
describe('project progress',()=>{
 it('excludes cancelled work and avoids dividing by zero',()=>{expect(projectProgress([])).toBe(0);expect(projectProgress([{status:'done'},{status:'todo'},{status:'cancelled'}])).toBe(50);});
 it('marks unfinished past-due work only',()=>{expect(overdue({status:'todo',due_date:'2026-11-21'},'2026-11-22')).toBe(true);expect(overdue({status:'done',due_date:'2026-11-21'},'2026-11-22')).toBe(false);expect(overdue({status:'todo',due_date:'2026-11-22'},'2026-11-22')).toBe(false);});
});
