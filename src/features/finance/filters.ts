import type { Transaction } from '@/types/database';
export type TransactionFilters={q?:string;type?:string;account?:string;category?:string;project?:string;from?:string;to?:string;sort?:string};
export function filterTransactions(rows:Transaction[],filters:TransactionFilters) {
 const query=(filters.q??'').trim().toLocaleLowerCase('vi');
 const filtered=rows.filter(t=>{
  if(query && !`${t.description} ${t.payee??''} ${t.notes}`.toLocaleLowerCase('vi').includes(query)) return false;
  if(filters.type && t.type!==filters.type) return false;
  if(filters.account && ![t.account_id,t.from_account_id,t.to_account_id].includes(filters.account)) return false;
  if(filters.category && t.category_id!==filters.category) return false;
  if(filters.project && t.project_id!==filters.project) return false;
  if(filters.from && t.transaction_date<filters.from) return false;
  if(filters.to && t.transaction_date>filters.to) return false;
  return true;
 });
 return filtered.sort((a,b)=>{
  if(filters.sort==='amount_asc') return a.amount-b.amount;
  if(filters.sort==='amount_desc') return b.amount-a.amount;
  if(filters.sort==='description_asc') return a.description.localeCompare(b.description,'vi');
  if(filters.sort==='description_desc') return b.description.localeCompare(a.description,'vi');
  if(filters.sort==='date_asc') return a.transaction_date.localeCompare(b.transaction_date);
  return b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at);
 });
}
