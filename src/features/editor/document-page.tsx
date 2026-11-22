'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DynamicEditor } from './dynamic-editor';
import { renamePage, saveDatabaseCell, savePage, saveRecordDocument } from '@/features/database/actions';
import type { DatabaseKey, Json } from '@/types/database';

type Props = {
  id: string;
  title: string;
  content: Json;
  databaseKey?: DatabaseKey;
  backHref: string;
  propertiesSlot?: React.ReactNode;
};

export function DocumentPage({ id, title, content, databaseKey, backHref, propertiesSlot }: Props) {
  const [name, setName] = useState(title);
  const nameRef = useRef(title);
  const savedNameRef = useRef(title);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (blocks: Json) => {
      const result = databaseKey
        ? await saveRecordDocument(databaseKey, id, blocks)
        : await savePage(id, nameRef.current.trim() || 'Không có tiêu đề', blocks);
      if (!result.ok) {
        toast.error(result.error);
        throw new Error(result.error);
      }
    },
    [databaseKey, id]
  );

  const saveTitle = useCallback(
    async (value: string, silent = false) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === savedNameRef.current) return;
      const result = databaseKey
        ? await saveDatabaseCell({
            databaseKey,
            recordId: id,
            propertyKey:
              databaseKey === 'tasks' || databaseKey === 'milestones'
                ? 'title'
                : databaseKey === 'transactions'
                  ? 'description'
                  : 'name',
            value: trimmed,
          })
        : await renamePage(id, trimmed);
      if (!result.ok) toast.error(result.error);
      else {
        savedNameRef.current = trimmed;
        if (!silent) toast.success('Đã lưu tiêu đề');
      }
    },
    [databaseKey, id]
  );

  useEffect(() => {
    return () => {
      if (titleTimer.current) clearTimeout(titleTimer.current);
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={backHref} className="text-sm text-muted hover:underline">
        ← Quay lại
      </Link>
      {databaseKey === 'budgets' ? (
        <h1 className="mt-6 mb-5 text-4xl font-semibold">{name}</h1>
      ) : (
        <input
          className="mt-6 mb-5 w-full border-0 bg-transparent text-4xl font-semibold outline-none"
          aria-label="Tiêu đề trang"
          value={name}
          onChange={event => {
            const next = event.target.value;
            nameRef.current = next;
            setName(next);
            if (titleTimer.current) clearTimeout(titleTimer.current);
            titleTimer.current = setTimeout(() => void saveTitle(next, true), 700);
          }}
          onBlur={() => {
            if (titleTimer.current) {
              clearTimeout(titleTimer.current);
              titleTimer.current = null;
            }
            void saveTitle(nameRef.current);
          }}
        />
      )}
      {propertiesSlot}
      <DynamicEditor initialContent={content} onSave={save} />
    </div>
  );
}
