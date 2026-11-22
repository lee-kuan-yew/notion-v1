import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/owner';
import { DocumentPage } from '@/features/editor/document-page';
export default async function PageDetail({params}:{params:Promise<{id:string}>}) {const {id}=await params;const {supabase,user}=await requireOwner();const result=await supabase.from('pages').select('*').eq('id',id).eq('user_id',user.id).single();if(result.error||!result.data)notFound();return <DocumentPage id={id} title={result.data.title} content={result.data.content} backHref="/app/pages"/>}
