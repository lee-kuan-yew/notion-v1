import { deleteRecord } from '@/features/workspace/actions';
import { ConfirmButton } from './confirm-button';
export function DeleteForm({table,id,returnTo}:{table:'accounts'|'categories'|'transactions'|'budgets'|'projects'|'tasks'|'milestones';id:string;returnTo:string}) {return <form action={deleteRecord}><input type="hidden" name="table" value={table}/><input type="hidden" name="id" value={id}/><input type="hidden" name="return_to" value={returnTo}/><ConfirmButton>Xóa</ConfirmButton></form>}
