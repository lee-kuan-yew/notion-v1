import { notFound } from 'next/navigation';
import { databaseConfig } from '@/features/database/config';
import { loadDatabase } from '@/features/database/queries';
import { DatabaseView } from '@/features/database/components/database-view';
import type { DatabaseKey } from '@/types/database';
export default async function DatabasePage({params,searchParams}:{params:Promise<{key:string}>;searchParams:Promise<{view?:string}>}) {
  const [{key},{view}]=await Promise.all([params,searchParams]);
  if(!(key in databaseConfig))notFound();
  const data=await loadDatabase(key as DatabaseKey);
  return <DatabaseView data={data} initialViewId={view}/>;
}
