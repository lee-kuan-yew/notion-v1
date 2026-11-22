import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/owner';
import { databaseConfig } from '@/features/database/config';
import { loadDatabase } from '@/features/database/queries';
import { rowTitle } from '@/features/database/status';
import { RecordPropertiesPanel } from '@/features/database/components/record-properties-panel';
import { DocumentPage } from '@/features/editor/document-page';
import type { DataRow } from '@/features/database/rules';
import type { DatabaseKey } from '@/types/database';

export default async function RecordPage({ params }: { params: Promise<{ key: string; id: string }> }) {
  const { key, id } = await params;
  if (!(key in databaseConfig)) notFound();
  const databaseKey = key as DatabaseKey;
  const data = await loadDatabase(databaseKey);
  const row = data.rows.find(item => item.id === id) as DataRow | undefined;
  if (!row) notFound();
  const { supabase, user } = await requireOwner();
  const document = await supabase
    .from('record_documents')
    .select('*')
    .eq('database_key', databaseKey)
    .eq('record_id', id)
    .eq('user_id', user.id);
  if (document.error) throw new Error(document.error.message);
  return (
    <DocumentPage
      id={id}
      databaseKey={databaseKey}
      title={rowTitle(row, databaseKey, data.lookups)}
      content={document.data[0]?.content ?? []}
      backHref={`/app/database/${key}`}
      propertiesSlot={
        <RecordPropertiesPanel
          databaseKey={databaseKey}
          initialRow={row}
          properties={data.properties}
          initialOptions={data.options}
          initialTags={data.tags}
          lookups={data.lookups}
        />
      }
    />
  );
}
