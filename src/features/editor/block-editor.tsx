'use client';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { BlockNoteSchema, filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import {
  createReactBlockSpec,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { createPage } from '@/features/database/actions';
import { databaseConfig, databaseKeys } from '@/features/database/config';
import { ColoredChip } from '@/features/database/components/database-table';
import { dateVN } from '@/components/shared/format';
import { detectPlatform, formatShortcut, isComposingEvent, matchShortcut } from '@/lib/shortcuts';
import { SelectDropdown } from '@/components/ui/dropdown';
import type { DatabaseKey, Json } from '@/types/database';

type EmbedRow = {
  id: string;
  title: string;
  status: string | null;
  statusColor: string | null;
  date: string | null;
};

function DatabaseEmbed({ databaseKey, viewType }: { databaseKey: string; viewType: string }) {
  const [state, setState] = useState<{ title: string; count: number; rows: EmbedRow[] } | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/database-embed/${databaseKey}`, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (active) setState(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [databaseKey]);

  const href = `/app/database/${databaseKey}`;
  const boardGroups = useMemo(() => {
    if (!state?.rows) return [];
    const map = new Map<string, { color: string | null; rows: EmbedRow[] }>();
    for (const row of state.rows) {
      const k = row.status || 'Chưa phân loại';
      const entry = map.get(k);
      if (entry) entry.rows.push(row);
      else map.set(k, { color: row.statusColor, rows: [row] });
    }
    return [...map.entries()];
  }, [state]);

  return (
    <div className="my-2 rounded-lg border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <a className="text-sm font-semibold underline" href={href}>
          {state?.title ?? databaseKey} · {state?.count ?? '…'} bản ghi
        </a>
        <span className="text-[11px] uppercase tracking-wide text-muted">{viewType}</span>
      </div>
      {viewType === 'board' ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {boardGroups.map(([groupName, group]) => (
            <div key={groupName} className="w-44 shrink-0 rounded-md border border-line bg-soft/60 p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <ColoredChip value={groupName} color={group.color ?? undefined} />
                <span className="text-[11px] text-muted">{group.rows.length}</span>
              </div>
              <div className="space-y-1">
                {group.rows.slice(0, 5).map(row => (
                  <a
                    key={row.id}
                    href={`${href}/${row.id}`}
                    className="block truncate rounded border border-line bg-surface px-2 py-1 text-xs hover:bg-soft"
                  >
                    {row.title}
                  </a>
                ))}
              </div>
            </div>
          ))}
          {boardGroups.length === 0 && <p className="text-xs text-muted">Chưa có bản ghi.</p>}
        </div>
      ) : viewType === 'calendar' ? (
        <div className="max-h-56 space-y-1 overflow-auto">
          {(state?.rows ?? [])
            .filter(row => row.date)
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
            .slice(0, 10)
            .map(row => (
              <a
                key={row.id}
                href={`${href}/${row.id}`}
                className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-soft"
              >
                <span className="truncate">
                  <strong className="mr-2 font-mono text-muted">{dateVN(row.date)}</strong>
                  {row.title}
                </span>
                {row.status && <ColoredChip value={row.status} color={row.statusColor ?? undefined} />}
              </a>
            ))}
          {state && !state.rows.some(r => r.date) && <p className="text-xs text-muted">Chưa có bản ghi có ngày.</p>}
        </div>
      ) : (
        <div className="max-h-56 overflow-auto">
          {(state?.rows ?? []).slice(0, 10).map(row => (
            <a
              key={row.id}
              href={`${href}/${row.id}`}
              className="flex items-center justify-between gap-2 border-t border-line py-1.5 text-xs hover:bg-soft"
            >
              <span className="truncate font-medium">{row.title}</span>
              <span className="flex shrink-0 items-center gap-2">
                {row.date && <span className="text-muted">{dateVN(row.date)}</span>}
                {row.status && <ColoredChip value={row.status} color={row.statusColor ?? undefined} />}
              </span>
            </a>
          ))}
          {state && state.rows.length === 0 && <p className="text-xs text-muted">Chưa có bản ghi.</p>}
        </div>
      )}
    </div>
  );
}

const calloutSpec = createReactBlockSpec(
  { type: 'callout', propSchema: {}, content: 'inline' },
  {
    render: ({ contentRef }) => (
      <div className="my-2 flex items-start gap-2 rounded-lg border-l-4 border-stone-400 bg-soft px-3 py-2">
        <span contentEditable={false} aria-hidden="true" className="select-none text-sm">
          💡
        </span>
        <div className="min-w-0 flex-1" ref={contentRef} />
      </div>
    ),
  }
);

const databaseSpec = createReactBlockSpec(
  {
    type: 'databaseEmbed',
    propSchema: {
      databaseKey: {
        default: 'tasks',
        values: ['transactions', 'accounts', 'budgets', 'categories', 'projects', 'tasks', 'milestones'] as const,
      },
      viewType: { default: 'table', values: ['table', 'board', 'calendar'] as const },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <div contentEditable={false} className="my-2">
        <div className="mb-1.5 flex flex-wrap gap-2 text-xs">
          <SelectDropdown
            size="sm"
            className="!w-48"
            aria-label="Nguồn dữ liệu"
            value={block.props.databaseKey}
            onChange={val =>
              editor.updateBlock(block, {
                props: { databaseKey: val as typeof block.props.databaseKey },
              })
            }
            options={databaseKeys.map(key => ({
              value: key,
              label: `${databaseConfig[key as DatabaseKey].title} (${key})`,
            }))}
          />
          <SelectDropdown
            size="sm"
            className="!w-32"
            aria-label="Kiểu view"
            value={block.props.viewType}
            onChange={val =>
              editor.updateBlock(block, {
                props: { viewType: val as typeof block.props.viewType },
              })
            }
            options={[
              { value: 'table', label: 'Bảng' },
              { value: 'board', label: 'Board' },
              { value: 'calendar', label: 'Lịch' },
            ]}
          />
        </div>
        <DatabaseEmbed databaseKey={block.props.databaseKey} viewType={block.props.viewType} />
      </div>
    ),
  }
);

const schema = BlockNoteSchema.create().extend({
  blockSpecs: { callout: calloutSpec(), databaseEmbed: databaseSpec() },
});

export type CustomSlashCommand = {
  title: string;
  aliases: string[];
  subtext?: string;
  group?: string;
  run: (editor: typeof schema.BlockNoteEditor) => void;
};

type EditorSave = (content: Json) => Promise<void>;

async function uploadImageFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/uploads/image', { method: 'POST', body: form });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) {
    const message = body.error || 'Không thể tải ảnh lên';
    toast.error(message);
    throw new Error(message);
  }
  toast.success('Đã tải ảnh lên');
  return body.url;
}

const EMPTY_COMMANDS: CustomSlashCommand[] = [];

export function BlockEditor({
  initialContent,
  onSave,
  customCommands = EMPTY_COMMANDS,
}: {
  initialContent: Json;
  onSave: EditorSave;
  customCommands?: CustomSlashCommand[];
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const platform = detectPlatform();
  const editor = useCreateBlockNote({
    schema,
    initialContent: Array.isArray(initialContent) && initialContent.length ? (initialContent as never) : undefined,
    uploadFile: uploadImageFile,
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Json>(initialContent);
  const saving = useRef<Promise<void> | null>(null);
  const dirty = useRef(false);
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [blockActionsOpen, setBlockActionsOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkLabel, setLinkLabel] = useState('');

  // Iterative flush avoids recursive self-reference inside useCallback
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (saving.current) {
      await saving.current;
    }
    while (dirty.current) {
      dirty.current = false;
      setStatus('saving');
      let failed = false;
      const content = latest.current;
      const pending = onSave(content)
        .then(() => {
          if (!dirty.current) setStatus('saved');
        })
        .catch(() => {
          dirty.current = true;
          failed = true;
          setStatus('error');
        });
      saving.current = pending;
      await pending;
      saving.current = null;
      if (failed) break;
    }
  }, [onSave]);

  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden' && dirty.current) void flush();
    };
    window.addEventListener('beforeunload', before);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('beforeunload', before);
      document.removeEventListener('visibilitychange', visibility);
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current) void flush();
    };
  }, [flush]);

  const scheduleSave = useCallback(() => {
    latest.current = editor.document as unknown as Json;
    dirty.current = true;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 400);
  }, [editor, flush]);

  const duplicateCurrentBlock = useCallback(() => {
    try {
      const current = editor.getTextCursorPosition().block;
      const cloned = {
        type: current.type,
        props: { ...current.props },
        content: Array.isArray(current.content) ? structuredClone(current.content) : current.content,
      };
      editor.insertBlocks([cloned as never], current, 'after');
      scheduleSave();
      toast.success('Đã nhân bản khối');
    } catch {
      toast.error('Không thể nhân bản khối hiện tại');
    }
  }, [editor, scheduleSave]);

  const openLinkRef = useRef<() => void>(() => {});
  function openLinkDialog() {
    const selectedText = typeof editor.getSelectedText === 'function' ? editor.getSelectedText() : '';
    setLinkLabel(selectedText);
    setLinkUrl('https://');
    setLinkDialogOpen(true);
    setBlockActionsOpen(false);
  }
  useEffect(() => {
    openLinkRef.current = openLinkDialog;
  });

  function applyLink(event: React.FormEvent) {
    event.preventDefault();
    const cleanUrl = linkUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      toast.error('URL phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    editor.createLink(cleanUrl, linkLabel.trim() || cleanUrl);
    setLinkDialogOpen(false);
    scheduleSave();
  }

  const items = useCallback(
    async (query: string): Promise<DefaultReactSuggestionItem[]> => {
      // Suppress slash menu when "/" is typed inside URLs (e.g. https://) or mid-word (e.g. a/b)
      try {
        const tiptap = (editor as unknown as { _tiptapEditor?: { state: { selection: { $from: { parent: { textBetween: (a: number, b: number) => string }; parentOffset: number } } } } })._tiptapEditor;
        if (tiptap) {
          const { $from } = tiptap.state.selection;
          const beforeCursor = $from.parent.textBetween(0, $from.parentOffset);
          const slashPos = beforeCursor.length - query.length - 1;
          if (slashPos > 0 && !/\s/.test(beforeCursor[slashPos - 1])) {
            return [];
          }
        }
      } catch {
        // Fallback to showing menu if internal selection shape differs
      }

      const command = (
        title: string,
        aliases: string[],
        subtext: string,
        run: () => void,
        group = 'Finanion'
      ): DefaultReactSuggestionItem => ({
        title,
        aliases,
        subtext,
        group,
        onItemClick: run,
      });

      const setBlock = (block: Record<string, unknown>) => {
        insertOrUpdateBlockForSlashMenu(editor, block as never);
      };

      const personalCommands: DefaultReactSuggestionItem[] = [
        command('Văn bản (/text)', ['text', 'paragraph', 'p'], 'Đoạn văn bản thường', () => setBlock({ type: 'paragraph' })),
        command('Trang mới (/page)', ['page', 'trang'], 'Tạo trang tài liệu mới và liên kết', () => {
          void createPage().then(async result => {
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            const url = `/app/pages/${result.value}`;
            editor.createLink(url, 'Trang mới');
            latest.current = editor.document as unknown as Json;
            dirty.current = true;
            await flush();
            router.push(url);
          });
        }),
        command('Tiêu đề 1 (/h1)', ['h1', 'heading1'], 'Tiêu đề cấp 1', () => setBlock({ type: 'heading', props: { level: 1 } })),
        command('Tiêu đề 2 (/h2)', ['h2', 'heading2'], 'Tiêu đề cấp 2', () => setBlock({ type: 'heading', props: { level: 2 } })),
        command('Tiêu đề 3 (/h3)', ['h3', 'heading3'], 'Tiêu đề cấp 3', () => setBlock({ type: 'heading', props: { level: 3 } })),
        command('Danh sách dấu chấm (/bullet)', ['bullet', 'ul', 'list'], 'Danh sách gạch đầu dòng', () =>
          setBlock({ type: 'bulletListItem' })
        ),
        command('Danh sách số (/num)', ['num', 'numbered', 'ol'], 'Danh sách đánh số', () =>
          setBlock({ type: 'numberedListItem' })
        ),
        command('Việc cần làm (/todo)', ['todo', 'checkbox', 'check'], 'Danh sách hộp kiểm', () =>
          setBlock({ type: 'checkListItem' })
        ),
        command('Thu gọn (/toggle)', ['toggle', 'collapse'], 'Danh sách đóng mở', () =>
          setBlock({ type: 'toggleListItem' })
        ),
        command('Trích dẫn (/quote)', ['quote', 'blockquote'], 'Khối trích dẫn', () => setBlock({ type: 'quote' })),
        command('Đường phân cách (/div)', ['div', 'divider', 'hr'], 'Đường kẻ ngang', () => setBlock({ type: 'divider' })),
        command('Mã nguồn (/code)', ['code', 'codeblock'], 'Khối mã nguồn', () => setBlock({ type: 'codeBlock' })),
        command('Hình ảnh (/image)', ['image', 'img', 'anh'], 'Tải ảnh lên hoặc dán URL ảnh', () =>
          setBlock({ type: 'image' })
        ),
        command('Liên kết (/link)', ['link', 'url'], 'Chèn liên kết http/https', () => openLinkRef.current()),
        command('Bảng nội dung (/table)', ['table', 'bang'], 'Bảng nội dung đơn giản (không phải database)', () =>
          setBlock({
            type: 'table',
            content: {
              type: 'tableContent',
              rows: [{ cells: ['', '', ''] }, { cells: ['', '', ''] }],
            },
          })
        ),
        command('Database (/database)', ['database', 'db'], 'Nhúng bảng dữ liệu thực tế', () =>
          setBlock({ type: 'databaseEmbed', props: { databaseKey: 'tasks', viewType: 'table' } })
        ),
        command('Board dữ liệu (/board)', ['board', 'kanban'], 'Nhúng Board từ dữ liệu thực tế', () =>
          setBlock({ type: 'databaseEmbed', props: { databaseKey: 'tasks', viewType: 'board' } })
        ),
        command('Lịch dữ liệu (/calendar)', ['calendar', 'lich'], 'Nhúng Lịch từ dữ liệu thực tế', () =>
          setBlock({ type: 'databaseEmbed', props: { databaseKey: 'tasks', viewType: 'calendar' } })
        ),
        command('Callout (/callout)', ['callout', 'note', 'ghi chu'], 'Khối nổi bật ghi chú', () =>
          setBlock({ type: 'callout' })
        ),
        ...customCommands.map(cmd =>
          command(cmd.title, cmd.aliases, cmd.subtext ?? '', () => cmd.run(editor), cmd.group ?? 'Tùy chỉnh')
        ),
      ];

      // Include remaining default BlockNote items (e.g. emoji, file, video) without duplicating our core commands
      const coreKeys = new Set([
        'paragraph',
        'heading',
        'heading_2',
        'heading_3',
        'bullet_list',
        'numbered_list',
        'check_list',
        'toggle_list',
        'quote',
        'divider',
        'code_block',
        'table',
        'image',
      ]);
      const defaultExtras = getDefaultReactSlashMenuItems(editor).filter(
        item => !coreKeys.has((item as { key?: string }).key ?? '')
      );
      return filterSuggestionItems([...personalCommands, ...defaultExtras], query);
    },
    [editor, router, flush, customCommands]
  );

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (isComposingEvent(event.nativeEvent)) return;
    if (event.key === 'Escape') {
      if (blockActionsOpen) {
        event.preventDefault();
        setBlockActionsOpen(false);
      }
      if (linkDialogOpen) {
        event.preventDefault();
        setLinkDialogOpen(false);
      }
      return;
    }
    if (matchShortcut(event.nativeEvent, { key: 'd', mod: true }, platform)) {
      event.preventDefault();
      event.stopPropagation();
      duplicateCurrentBlock();
      return;
    }
    if (matchShortcut(event.nativeEvent, { key: '/', mod: true }, platform)) {
      event.preventDefault();
      event.stopPropagation();
      setBlockActionsOpen(curr => !curr);
      return;
    }
    if (matchShortcut(event.nativeEvent, { key: 'k', mod: true }, platform)) {
      event.preventDefault();
      event.stopPropagation();
      openLinkDialog();
      return;
    }
    if (matchShortcut(event.nativeEvent, { key: 'Enter', mod: true }, platform)) {
      try {
        const current = editor.getTextCursorPosition().block;
        if (current.type === 'checkListItem') {
          event.preventDefault();
          event.stopPropagation();
          const checked = Boolean((current.props as { checked?: boolean }).checked);
          editor.updateBlock(current, { props: { checked: !checked } } as never);
          scheduleSave();
        }
      } catch {
        // Ignore when cursor is not inside a checkListItem
      }
    }
  }

  function runBlockAction(action: string) {
    try {
      const current = editor.getTextCursorPosition().block;
      if (action === 'duplicate') {
        duplicateCurrentBlock();
      } else if (action === 'delete') {
        editor.removeBlocks([current]);
        scheduleSave();
      } else if (action === 'paragraph') {
        editor.updateBlock(current, { type: 'paragraph' } as never);
        scheduleSave();
      } else if (action === 'h1') {
        editor.updateBlock(current, { type: 'heading', props: { level: 1 } } as never);
        scheduleSave();
      } else if (action === 'h2') {
        editor.updateBlock(current, { type: 'heading', props: { level: 2 } } as never);
        scheduleSave();
      } else if (action === 'todo') {
        editor.updateBlock(current, { type: 'checkListItem' } as never);
        scheduleSave();
      } else if (action === 'quote') {
        editor.updateBlock(current, { type: 'quote' } as never);
        scheduleSave();
      } else if (action === 'callout') {
        editor.updateBlock(current, { type: 'callout' } as never);
        scheduleSave();
      }
    } catch {
      toast.error('Không thể thực hiện thao tác khối');
    } finally {
      setBlockActionsOpen(false);
    }
  }

  return (
    <div
      data-block-editor="true"
      className="relative rounded-lg border border-line bg-surface p-3"
      onKeyDown={handleEditorKeyDown}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-2">
          <span>Gõ &quot;/&quot; để mở lệnh khối</span>
          <button
            type="button"
            className="rounded border border-line px-1.5 py-0.5 hover:bg-soft"
            onClick={() => setBlockActionsOpen(v => !v)}
            title={`Thao tác khối (${formatShortcut({ key: '/', mod: true }, platform)})`}
          >
            Thao tác khối ({formatShortcut({ key: '/', mod: true }, platform)})
          </button>
          <button
            type="button"
            className="rounded border border-line px-1.5 py-0.5 hover:bg-soft"
            onClick={openLinkDialog}
            title={`Chèn liên kết (${formatShortcut({ key: 'k', mod: true }, platform)})`}
          >
            Liên kết ({formatShortcut({ key: 'k', mod: true }, platform)})
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span role="status">{status === 'saving' ? 'Đang lưu…' : status === 'error' ? 'Lỗi lưu' : 'Đã lưu'}</span>
          <button type="button" className="underline" onClick={() => void flush()}>
            Lưu ngay
          </button>
        </div>
      </div>

      {blockActionsOpen && (
        <div className="mb-3 flex flex-wrap items-center gap-1 rounded-lg border border-line bg-soft p-2 text-xs">
          <span className="mr-1 font-semibold text-muted">Thao tác khối:</span>
          {[
            ['paragraph', 'Văn bản'],
            ['h1', 'H1'],
            ['h2', 'H2'],
            ['todo', 'Việc cần làm'],
            ['quote', 'Trích dẫn'],
            ['callout', 'Callout'],
            ['duplicate', `Nhân bản (${formatShortcut({ key: 'd', mod: true }, platform)})`],
          ].map(([id, text]) => (
            <button
              key={id}
              type="button"
              className="rounded border border-line bg-surface px-2 py-1 hover:bg-soft"
              onClick={() => runBlockAction(id)}
            >
              {text}
            </button>
          ))}
          <button
            type="button"
            className="rounded border border-line bg-surface px-2 py-1 text-red-600 hover:bg-soft"
            onClick={() => runBlockAction('delete')}
          >
            Xóa khối
          </button>
          <button type="button" className="ml-auto text-muted underline" onClick={() => setBlockActionsOpen(false)}>
            Đóng (Esc)
          </button>
        </div>
      )}

      {linkDialogOpen && (
        <form
          onSubmit={applyLink}
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-soft p-2.5 text-xs"
        >
          <input
            autoFocus
            className="input !w-64 !py-1"
            aria-label="URL liên kết"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
          />
          <input
            className="input !w-44 !py-1"
            aria-label="Văn bản hiển thị"
            placeholder="Văn bản hiển thị (tùy chọn)"
            value={linkLabel}
            onChange={e => setLinkLabel(e.target.value)}
          />
          <button type="submit" className="btn btn-primary !py-1 text-xs">
            Chèn liên kết
          </button>
          <button type="button" className="text-muted underline" onClick={() => setLinkDialogOpen(false)}>
            Hủy
          </button>
        </form>
      )}

      <BlockNoteView
        editor={editor}
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        slashMenu={false}
        onChange={scheduleSave}
      >
        <SuggestionMenuController triggerCharacter="/" getItems={items} />
      </BlockNoteView>
    </div>
  );
}
