'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { tableFeatures, useTable, type ColumnDef } from '@tanstack/react-table';
import type { Transaction } from '@/types/database';
import { money } from '@/lib/finance';
import { dateVN,label } from '@/components/shared/format';
import { ConfirmButton } from '@/components/shared/confirm-button';
import { deleteRecord } from '@/features/workspace/actions';
const features=tableFeatures({});
export function TransactionTable({rows,accounts,categories,projects}:{rows:Transaction[];accounts:Record<string,string>;categories:Record<string,string>;projects:Record<string,string>}) {
 const columns=useMemo<ColumnDef<typeof features,Transaction>[]>(()=>[
  {accessorKey:'transaction_date',header:'Ngày',cell:info=>dateVN(info.row.original.transaction_date)},
  {accessorKey:'description',header:'Giao dịch',cell:info=><><span className="font-semibold">{info.row.original.description||label(info.row.original.type)}</span><br/><span className="meta">{info.row.original.payee||label(info.row.original.type)}</span></>},
  {id:'account',header:'Tài khoản',cell:info=>{const t=info.row.original;return t.type==='transfer'?`${accounts[t.from_account_id??'']??'—'} → ${accounts[t.to_account_id??'']??'—'}`:accounts[t.account_id??'']??'—';}},
  {id:'category',header:'Danh mục / Dự án',cell:info=>{const t=info.row.original;return <>{categories[t.category_id??'']??'—'}{t.project_id&&<><br/><Link className="text-xs underline" href={`/app/projects/${t.project_id}`}>{projects[t.project_id]}</Link></>}</>;}},
  {accessorKey:'amount',header:'Số tiền',cell:info=>{const t=info.row.original;return <span className={`font-semibold ${t.type==='income'?'text-green-600':t.type==='expense'?'text-red-600':''}`}>{t.type==='income'?'+':t.type==='expense'?'-':''}{money(t.amount)}</span>;}},
  {id:'actions',header:'',cell:info=><div className="flex gap-2"><Link className="btn !px-2 !py-1 text-xs" href={`?edit=${info.row.original.id}`}>Sửa</Link><form action={deleteRecord}><input type="hidden" name="table" value="transactions"/><input type="hidden" name="id" value={info.row.original.id}/><input type="hidden" name="return_to" value="/app/finance/transactions"/><ConfirmButton>Xóa</ConfirmButton></form></div>},
 ],[accounts,categories,projects]);
 const table=useTable({data:rows,columns,features});
 return <div className="table-wrap"><table className="data-table"><thead>{table.getHeaderGroups().map(group=><tr key={group.id}>{group.headers.map(header=><th key={header.id}>{header.isPlaceholder?null:<table.FlexRender header={header}/>}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(row=><tr key={row.id}>{row.getAllCells().map(cell=><td key={cell.id}><table.FlexRender cell={cell}/></td>)}</tr>)}</tbody></table></div>;
}
