'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';

const id = z.uuid();
const optionalId = z.union([id,z.literal('')]).transform(value => value || null);
const date = z.iso.date();
const optionalDate = z.union([date,z.literal('')]).transform(value => value || null);
const text = z.string().trim().max(1000);
const name = z.string().trim().min(1).max(120);
const cleanNumericString = (value: unknown) =>
  typeof value === 'string' ? value.replace(/[,\s]/g, '') : value;
const amount = z.preprocess(cleanNumericString, z.coerce.number().positive().max(9999999999999));
const optionalAmount = z.preprocess(
  cleanNumericString,
  z.union([z.literal(''), z.coerce.number().nonnegative().max(9999999999999)]).transform(value => (value === '' ? null : value))
);
const signedAmount = z.preprocess(cleanNumericString, z.coerce.number().min(-9999999999999).max(9999999999999));
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const raw = (form: FormData, key: string) => String(form.get(key) ?? '');
function parse<T>(schema: z.ZodType<T>, data: unknown, path: string): T {
  const result = schema.safeParse(data);
  if (!result.success) redirect(`${path}${path.includes('?')?'&':'?'}error=${encodeURIComponent(result.error.issues[0]?.message ?? 'Invalid input')}`);
  return result.data;
}
function done(path: string) {
  revalidatePath('/app','layout');
  redirect(`${path}${path.includes('?')?'&':'?'}saved=1`);
}
function dbError(message: string, path: string) { redirect(`${path}${path.includes('?')?'&':'?'}error=${encodeURIComponent(message)}`); }

export async function saveAccount(form: FormData) {
  const path = '/app/finance/accounts';
  const input = parse(z.object({ name, account_type:z.enum(['bank','cash','e_wallet','savings','other']), opening_balance:signedAmount, opening_balance_date:date, color }), {
    name:raw(form,'name'),account_type:raw(form,'account_type'),opening_balance:raw(form,'opening_balance'),opening_balance_date:raw(form,'opening_balance_date'),color:raw(form,'color') || '#78716C'
  },path);
  const { supabase,user } = await requireOwner();
  const recordId = raw(form,'id');
  const result = recordId ? await supabase.from('accounts').update(input).eq('id',parse(id,recordId,path)).eq('user_id',user.id) : await supabase.from('accounts').insert({...input,user_id:user.id});
  if (result.error) dbError(result.error.message,path);
  done(path);
}
export async function saveCategory(form: FormData) {
  const path = '/app/finance/categories';
  const input = parse(z.object({ name,kind:z.enum(['income','expense']),parent_id:optionalId,icon:text,color }),{
    name:raw(form,'name'),kind:raw(form,'kind'),parent_id:raw(form,'parent_id'),icon:raw(form,'icon'),color:raw(form,'color') || '#78716C'
  },path);
  const {supabase,user}=await requireOwner();
  const payload = {...input,icon:input.icon || null};
  const recordId=raw(form,'id');
  const result=recordId ? await supabase.from('categories').update(payload).eq('id',parse(id,recordId,path)).eq('user_id',user.id) : await supabase.from('categories').insert({...payload,user_id:user.id});
  if(result.error) dbError(result.error.message,path);
  done(path);
}
export async function saveTransaction(form: FormData) {
  const path='/app/finance/transactions';
  const input=parse(z.object({type:z.enum(['income','expense','transfer']),amount,transaction_date:date,account_id:optionalId,from_account_id:optionalId,to_account_id:optionalId,category_id:optionalId,project_id:optionalId,payee:text,description:text,notes:text}).superRefine((v,ctx)=>{
    if(v.type==='transfer') {
      if(!v.from_account_id || !v.to_account_id || v.from_account_id===v.to_account_id) ctx.addIssue({code:'custom',message:'Choose two different transfer accounts'});
    } else if(!v.account_id || !v.category_id) ctx.addIssue({code:'custom',message:'Account and category are required'});
  }),{
    type:raw(form,'type'),amount:raw(form,'amount'),transaction_date:raw(form,'transaction_date'),account_id:raw(form,'account_id'),from_account_id:raw(form,'from_account_id'),to_account_id:raw(form,'to_account_id'),category_id:raw(form,'category_id'),project_id:raw(form,'project_id'),payee:raw(form,'payee'),description:raw(form,'description'),notes:raw(form,'notes')
  },path);
  const payload={...input,account_id:input.type==='transfer'?null:input.account_id,from_account_id:input.type==='transfer'?input.from_account_id:null,to_account_id:input.type==='transfer'?input.to_account_id:null,category_id:input.type==='transfer'?null:input.category_id,project_id:input.type==='expense'?input.project_id:null,payee:input.payee||null};
  const {supabase,user}=await requireOwner();
  const recordId=raw(form,'id');
  const result=recordId ? await supabase.from('transactions').update(payload).eq('id',parse(id,recordId,path)).eq('user_id',user.id) : await supabase.from('transactions').insert({...payload,user_id:user.id});
  if(result.error) dbError(result.error.message,path);
  done(path);
}
export async function saveBudget(form: FormData) {
  const path='/app/finance/budgets';
  const input=parse(z.object({category_id:id,month_start:date.refine(v=>v.endsWith('-01'),'Month must start on day 1'),amount}),{category_id:raw(form,'category_id'),month_start:raw(form,'month_start'),amount:raw(form,'amount')},path);
  const {supabase,user}=await requireOwner();
  const recordId=raw(form,'id');
  const result=recordId ? await supabase.from('budgets').update(input).eq('id',parse(id,recordId,path)).eq('user_id',user.id) : await supabase.from('budgets').insert({...input,user_id:user.id});
  if(result.error) dbError(result.error.message,path);
  done(path);
}
export async function saveProject(form: FormData) {
  const path='/app/projects';
  const input=parse(z.object({name,description:text,status:z.enum(['idea','planning','active','on_hold','completed','archived']),priority:z.enum(['low','medium','high','urgent']),start_date:optionalDate,due_date:optionalDate,budget_amount:optionalAmount,color}),{
    name:raw(form,'name'),description:raw(form,'description'),status:raw(form,'status'),priority:raw(form,'priority'),start_date:raw(form,'start_date'),due_date:raw(form,'due_date'),budget_amount:raw(form,'budget_amount'),color:raw(form,'color')||'#78716C'
  },path);
  if(input.start_date && input.due_date && input.due_date<input.start_date) dbError('Due date must follow start date',path);
  const {supabase,user}=await requireOwner();
  const recordId=raw(form,'id');
  const result=recordId ? await supabase.from('projects').update(input).eq('id',parse(id,recordId,path)).eq('user_id',user.id) : await supabase.from('projects').insert({...input,user_id:user.id});
  if(result.error) dbError(result.error.message,path);
  done(path);
}
export async function saveTask(form: FormData) {
  const path='/app/tasks';
  const input=parse(z.object({project_id:optionalId,title:name,description:text,status:z.enum(['backlog','todo','in_progress','review','done','cancelled']),priority:z.enum(['low','medium','high','urgent']),start_date:optionalDate,due_date:optionalDate,estimated_cost:optionalAmount,position:z.coerce.number().int().nonnegative()}),{
    project_id:raw(form,'project_id'),title:raw(form,'title'),description:raw(form,'description'),status:raw(form,'status'),priority:raw(form,'priority'),start_date:raw(form,'start_date'),due_date:raw(form,'due_date'),estimated_cost:raw(form,'estimated_cost'),position:raw(form,'position')||'0'
  },path);
  if(input.start_date && input.due_date && input.due_date<input.start_date) dbError('Due date must follow start date',path);
  const {supabase,user}=await requireOwner();
  const recordId=raw(form,'id');
  const result=recordId ? await supabase.from('tasks').update(input).eq('id',parse(id,recordId,path)).eq('user_id',user.id) : await supabase.from('tasks').insert({...input,user_id:user.id});
  if(result.error) dbError(result.error.message,path);
  done(path);
}
export async function moveTask(taskId: string, status: 'backlog'|'todo'|'in_progress'|'review'|'done', position: number) {
  const {supabase,user}=await requireOwner();
  const parsed=parse(z.object({taskId:id,status:z.enum(['backlog','todo','in_progress','review','done']),position:z.number().int().nonnegative()}),{taskId,status,position},'/app/tasks');
  const {error}=await supabase.from('tasks').update({status:parsed.status,position:parsed.position}).eq('id',parsed.taskId).eq('user_id',user.id);
  if(error) throw new Error(error.message);
  revalidatePath('/app','layout');
}
export async function reorderTasks(updates: {id:string;status:'backlog'|'todo'|'in_progress'|'review'|'done';position:number}[]) {
  const parsed=parse(z.array(z.object({id,status:z.enum(['backlog','todo','in_progress','review','done']),position:z.number().int().nonnegative()})).max(500),updates,'/app/tasks');
  const {supabase}=await requireOwner();
  const {error}=await supabase.rpc('reorder_tasks',{p_updates:parsed});
  if(error) throw new Error(error.message);
  revalidatePath('/app','layout');
}
export async function archiveProject(form: FormData) {
  const path='/app/projects';
  const recordId=parse(id,raw(form,'id'),path);
  const {supabase,user}=await requireOwner();
  const {error}=await supabase.from('projects').update({status:'archived'}).eq('id',recordId).eq('user_id',user.id);
  if(error) dbError(error.message,path);
  done(path);
}
export async function saveMilestone(form: FormData) {
  const projectId=parse(id,raw(form,'project_id'),'/app/projects');
  const path=`/app/projects/${projectId}?tab=milestones`;
  const input=parse(z.object({title:name,description:text,due_date:optionalDate,status:z.enum(['pending','in_progress','completed']),position:z.coerce.number().int().nonnegative()}),{
    title:raw(form,'title'),description:raw(form,'description'),due_date:raw(form,'due_date'),status:raw(form,'status'),position:raw(form,'position')||'0'
  },path);
  const {supabase,user}=await requireOwner();
  const recordId=raw(form,'id');
  const payload={...input,project_id:projectId};
  const result=recordId ? await supabase.from('milestones').update(payload).eq('id',parse(id,recordId,path)).eq('user_id',user.id) : await supabase.from('milestones').insert({...payload,user_id:user.id});
  if(result.error) dbError(result.error.message,path);
  done(path);
}
const deletable=z.enum(['accounts','categories','transactions','budgets','projects','tasks','milestones']);
export async function deleteRecord(form: FormData) {
  const table=parse(deletable,raw(form,'table'),'/app');
  const recordId=parse(id,raw(form,'id'),'/app');
  const path=raw(form,'return_to');
  const safePath=path.startsWith('/app/') && !path.startsWith('//') ? path : '/app';
  const {supabase,user}=await requireOwner();
  const {error}=await supabase.from(table).delete().eq('id',recordId).eq('user_id',user.id);
  if(error) dbError(error.message,safePath);
  done(safePath);
}
export async function archiveRecord(form: FormData) {
  const table=parse(z.enum(['accounts','categories']),raw(form,'table'),'/app');
  const recordId=parse(id,raw(form,'id'),'/app');
  const path=table==='accounts'?'/app/finance/accounts':'/app/finance/categories';
  const {supabase,user}=await requireOwner();
  const {error}=await supabase.from(table).update({is_archived:true}).eq('id',recordId).eq('user_id',user.id);
  if(error) dbError(error.message,path);
  done(path);
}
