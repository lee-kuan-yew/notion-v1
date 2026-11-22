'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { saveDatabaseCell, setRecordTag } from '../actions';
import { PropertyEditor, formatPropertyCell } from './database-table';
import type { DataRow } from '../rules';
import type { DatabaseKey, DatabaseProperty, PropertyOption, TagOption } from '@/types/database';

export function RecordPropertiesPanel({
  databaseKey,
  initialRow,
  properties,
  initialOptions,
  initialTags,
  lookups,
}: {
  databaseKey: DatabaseKey;
  initialRow: DataRow;
  properties: DatabaseProperty[];
  initialOptions: PropertyOption[];
  initialTags: TagOption[];
  lookups: Record<string, Record<string, string>>;
}) {
  const router = useRouter();
  const [row, setRow] = useState<DataRow>(initialRow);
  const [options, setOptions] = useState<PropertyOption[]>(initialOptions);
  const [tags, setTags] = useState<TagOption[]>(initialTags);
  const [editing, setEditing] = useState<string | null>(null);

  const onChange = useCallback(
    async (id: string, propertyKey: string, value: unknown) => {
      const result = await saveDatabaseCell({ databaseKey, recordId: id, propertyKey, value });
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      setRow(curr =>
        propertyKey.startsWith('custom_')
          ? { ...curr, custom_properties: { ...(curr.custom_properties as Record<string, unknown>), [propertyKey]: result.value } }
          : { ...curr, [propertyKey]: result.value }
      );
      toast.success('Đã lưu');
      router.refresh();
      return true;
    },
    [databaseKey, router]
  );

  const onTag = useCallback(
    async (id: string, tagId: string, selected: boolean) => {
      const result = await setRecordTag(databaseKey, id, tagId, selected);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      setRow(curr => ({
        ...curr,
        tags: selected
          ? [...new Set([...((curr.tags as string[]) ?? []), tagId])]
          : ((curr.tags as string[]) ?? []).filter(t => t !== tagId),
      }));
      return true;
    },
    [databaseKey]
  );

  return (
    <section className="mb-6 rounded-lg border border-line bg-surface p-4">
      <div className="divide-y divide-line/70">
        {properties.map(property => (
          <div key={property.id} className="grid grid-cols-[150px_1fr] items-center gap-3 py-2 text-sm">
            <span className="text-muted">{property.property_name}</span>
            <div>
              {editing === property.id ? (
                <PropertyEditor
                  databaseKey={databaseKey}
                  row={row}
                  property={property}
                  options={options}
                  tags={tags}
                  lookups={lookups}
                  onChange={onChange}
                  onTag={onTag}
                  onOptionCreated={opt => setOptions(curr => [...curr, opt])}
                  onTagCreated={tag => setTags(curr => [...curr, tag])}
                  onClose={() => setEditing(null)}
                />
              ) : (
                <button
                  type="button"
                  className="w-full rounded px-1.5 py-0.5 text-left hover:bg-soft"
                  onClick={() => setEditing(property.id)}
                >
                  {formatPropertyCell(databaseKey, row, property, lookups, options, tags)}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
