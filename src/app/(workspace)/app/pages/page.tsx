import { requireOwner } from '@/lib/auth/owner';
import { PagesList } from '@/features/editor/pages-list';
export default async function Pages() {const {supabase}=await requireOwner();const result=await supabase.from('pages').select('*').order('updated_at',{ascending:false});if(result.error)throw new Error(result.error.message);return <PagesList pages={result.data}/>}
