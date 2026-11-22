import { requireOwner } from '@/lib/auth/owner';
import { filterTransactions } from '@/features/finance/filters';
export async function GET(request:Request) {
 const {supabase,user}=await requireOwner();
 const {data,error}=await supabase.from('transactions').select('*').eq('user_id',user.id).order('transaction_date',{ascending:false});
 if(error) return new Response(error.message,{status:500});
 const params=Object.fromEntries(new URL(request.url).searchParams.entries());
 const rows=filterTransactions(data??[],params);
 const cell=(v:unknown)=>{let value=String(v??'');if(/^[=+\-@]/.test(value)) value=`'${value}`;return `"${value.replaceAll('"','""')}"`;};
 const columns=['transaction_date','type','amount','account_id','from_account_id','to_account_id','category_id','project_id','payee','description','notes'] as const;
 const csv='\uFEFF'+[columns.join(','),...rows.map(row=>columns.map(col=>cell(row[col])).join(','))].join('\r\n');
 return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="personal-os-transactions.csv"','Cache-Control':'private, no-store'}});
}
