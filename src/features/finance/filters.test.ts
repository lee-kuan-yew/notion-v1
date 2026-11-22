import { describe,it,expect } from 'vitest';
import { filterTransactions } from './filters';
import type { Transaction } from '@/types/database';
const base={id:'1',user_id:'u',created_at:'2026-11-22T00:00:00Z',updated_at:'2026-11-22T00:00:00Z',type:'expense',amount:10,transaction_date:'2026-11-22',account_id:'a',from_account_id:null,to_account_id:null,category_id:'c',project_id:'p',payee:'Cửa hàng',description:'Marketing',notes:'',custom_properties:{}} satisfies Transaction;
describe('transaction filters',()=>{
 it('finds an account on either side of a transfer',()=>{const transfer={...base,id:'2',type:'transfer' as const,account_id:null,from_account_id:'a',to_account_id:'b',category_id:null,project_id:null};expect(filterTransactions([base,transfer],{account:'b'}).map(t=>t.id)).toEqual(['2']);});
 it('applies inclusive date bounds and project filter',()=>{const earlier={...base,id:'3',transaction_date:'2026-11-01',project_id:null};expect(filterTransactions([base,earlier],{from:'2026-11-22',to:'2026-11-22',project:'p'}).map(t=>t.id)).toEqual(['1']);});
 it('searches Vietnamese text and sorts amounts',()=>{const other={...base,id:'4',amount:20,payee:'Khác'};expect(filterTransactions([base,other],{q:'cửa',sort:'amount_desc'}).map(t=>t.id)).toEqual(['1']);expect(filterTransactions([base,other],{sort:'amount_desc'}).map(t=>t.id)).toEqual(['4','1']);});
});
