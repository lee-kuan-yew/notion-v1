'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, MoreHorizontal, ChevronDown, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';
import { money } from '@/lib/finance';
import { dateVN, label } from '@/components/shared/format';
import { detectPlatform, isComposingEvent, matchShortcut } from '@/lib/shortcuts';
import { propertyValue, type DataRow } from '../rules';
import { databaseConfig, mutableFields } from '../config';
import {
  STATUS_GROUP_LABELS,
  STATUS_GROUP_ORDER,
  SYSTEM_SELECT_CHOICES,
  getSystemStatusOptions,
  resolveStatusOrSelectDisplay,
  rowTitle,
  type StatusMeta,
} from '../status';
import { saveDatabaseProperty, deleteDatabaseProperty, savePropertyOption, saveTagOption } from '../actions';
import { SelectDropdown } from '@/components/ui/dropdown';
import { MoneyInput } from '@/components/ui/money-input';
import type { DatabaseKey, DatabaseProperty, PropertyOption, TagOption, PropertyType, StatusGroup } from '@/types/database';

export const typeLabels: Record<PropertyType, string> = {
  title: 'Tiêu đề',
  text: 'Văn bản',
  number: 'Số',
  currency: 'Tiền tệ',
  select: 'Chọn một',
  multi_select: 'Chọn nhiều',
  status: 'Trạng thái',
  date: 'Ngày',
  checkbox: 'Checkbox',
  relation: 'Liên kết',
  url: 'URL',
  formula: 'Công thức',
  created_time: 'Tạo lúc',
  last_edited_time: 'Sửa lúc',
};

export function ColoredChip({ value, color }: { value: string; color?: string }) {
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded px-2 py-0.5 text-xs font-medium"
      style={
        color
          ? { backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }
          : { backgroundColor: 'var(--soft)', color: 'var(--text)' }
      }
    >
      {value}
    </span>
  );
}

export function isPropertyEditable(databaseKey: DatabaseKey, property: DatabaseProperty, row?: DataRow): boolean {
  if (property.property_key === 'tags') return true;
  if (['formula', 'created_time', 'last_edited_time'].includes(property.property_type)) return false;
  if (!property.is_system_property) return true;
  if (!mutableFields[databaseKey].includes(property.property_key)) return false;
  if (databaseKey === 'transactions' && row) {
    if (row.type === 'transfer' && ['account_id', 'category_id', 'project_id'].includes(property.property_key)) {
      return false;
    }
    if (row.type === 'income' && property.property_key === 'project_id') {
      return false;
    }
  }
  return true;
}

export function formatPropertyText(
  databaseKey: DatabaseKey,
  row: DataRow,
  property: DatabaseProperty,
  lookups: Record<string, Record<string, string>>,
  options: PropertyOption[],
  tags: TagOption[]
): string {
  if (databaseKey === 'transactions' && property.property_key === 'account_id' && row.type === 'transfer') {
    const from = lookups.accounts?.[String(row.from_account_id ?? '')] ?? '—';
    const to = lookups.accounts?.[String(row.to_account_id ?? '')] ?? '—';
    return `${from} → ${to}`;
  }
  const value = propertyValue(row, property.property_key);
  if (value == null || value === '') return '';
  if (property.property_key === 'tags') {
    return (Array.isArray(value) ? value : [])
      .map(id => tags.find(t => t.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }
  if (property.property_type === 'relation') {
    return lookups[String(property.configuration.target ?? '')]?.[String(value)] ?? '';
  }
  if (property.property_type === 'select' || property.property_type === 'status') {
    return resolveStatusOrSelectDisplay(databaseKey, property, String(value), options).label;
  }
  if (property.property_type === 'multi_select') {
    return (Array.isArray(value) ? value : [])
      .map(id => options.find(o => o.id === id)?.label)
      .filter(Boolean)
      .join(', ');
  }
  if (property.property_type === 'date') return dateVN(String(value));
  if (property.property_type === 'currency') {
    try {
      return money(String(value));
    } catch {
      return String(value);
    }
  }
  if (property.property_type === 'formula') {
    const fmt = String(property.configuration.format ?? '');
    if (['actual_spending', 'current_balance'].includes(property.property_key) || fmt === 'currency') {
      try {
        return money(Number(value).toFixed(2));
      } catch {
        return String(value);
      }
    }
    if (property.property_key === 'progress' || fmt === 'percent') return `${value}%`;
  }
  return String(value);
}

export function formatPropertyCell(
  databaseKey: DatabaseKey,
  row: DataRow,
  property: DatabaseProperty,
  lookups: Record<string, Record<string, string>>,
  options: PropertyOption[],
  tags: TagOption[]
) {
  if (databaseKey === 'transactions' && property.property_key === 'account_id' && row.type === 'transfer') {
    const from = lookups.accounts?.[String(row.from_account_id ?? '')] ?? '—';
    const to = lookups.accounts?.[String(row.to_account_id ?? '')] ?? '—';
    return <span className="text-xs text-muted">{from} → {to}</span>;
  }
  const value = propertyValue(row, property.property_key);
  if (value == null || value === '') {
    if (property.property_key === databaseConfig[databaseKey].titleKey) {
      return <span>{rowTitle(row, databaseKey, lookups)}</span>;
    }
    return <span className="text-muted/50">—</span>;
  }
  if (property.property_key === 'tags') {
    const list = Array.isArray(value) ? value : [];
    if (!list.length) return <span className="text-muted/50">—</span>;
    return (
      <span className="flex flex-wrap gap-1">
        {list.map(id => {
          const tag = tags.find(t => t.id === id);
          return tag ? <ColoredChip key={tag.id} value={tag.name} color={tag.color} /> : null;
        })}
      </span>
    );
  }
  if (property.property_type === 'relation') {
    return lookups[String(property.configuration.target ?? '')]?.[String(value)] ?? '—';
  }
  if (property.property_type === 'currency') {
    try {
      const formatted = money(String(value));
      if (databaseKey === 'transactions' && property.property_key === 'amount') {
        const cls = row.type === 'income' ? 'text-green-600 font-medium' : row.type === 'expense' ? 'text-red-600 font-medium' : 'font-medium';
        return <span className={cls}>{formatted}</span>;
      }
      return formatted;
    } catch {
      return String(value);
    }
  }
  if (property.property_type === 'date') return dateVN(String(value));
  if (property.property_type === 'created_time' || property.property_type === 'last_edited_time') {
    return new Date(String(value)).toLocaleString('vi-VN');
  }
  if (property.property_type === 'checkbox') return value ? '☑' : '☐';
  if (property.property_type === 'select' || property.property_type === 'status') {
    const resolved = resolveStatusOrSelectDisplay(databaseKey, property, String(value), options);
    return <ColoredChip value={resolved.label} color={resolved.color} />;
  }
  if (property.property_type === 'multi_select') {
    const list = Array.isArray(value) ? value : [];
    if (!list.length) return <span className="text-muted/50">—</span>;
    return (
      <span className="flex flex-wrap gap-1">
        {list.map(id => {
          const option = options.find(o => o.id === id);
          return option ? <ColoredChip key={option.id} value={option.label} color={option.color} /> : null;
        })}
      </span>
    );
  }
  if (property.property_type === 'url') {
    return (
      <a className="underline" href={String(value)} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>
        {String(value)}
      </a>
    );
  }
  if (property.property_type === 'formula') {
    const fmt = String(property.configuration.format ?? '');
    if (['actual_spending', 'current_balance'].includes(property.property_key) || fmt === 'currency') {
      try {
        return money(Number(value).toFixed(2));
      } catch {
        return String(value);
      }
    }
    if (property.property_key === 'progress' || fmt === 'percent') return `${value}%`;
  }
  return String(value);
}

type CellProps = {
  databaseKey: DatabaseKey;
  row: DataRow;
  property: DatabaseProperty;
  options: PropertyOption[];
  tags: TagOption[];
  lookups: Record<string, Record<string, string>>;
  wrap?: boolean;
  onChange: (id: string, key: string, value: unknown) => Promise<boolean>;
  onTag: (id: string, tag: string, selected: boolean) => Promise<boolean>;
  onOptionCreated?: (option: PropertyOption) => void;
  onTagCreated?: (tag: TagOption) => void;
  onOpen: (id: string) => void;
  onOpenFullPage?: (id: string) => void;
  onAdvance?: (direction: 1 | -1) => void;
};

const PALETTE = ['#78716C', '#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777'];

export function PropertyEditor({
  databaseKey,
  row,
  property,
  options,
  tags,
  lookups,
  onChange,
  onTag,
  onOptionCreated,
  onTagCreated,
  onClose,
  onAdvance,
}: Omit<CellProps, 'onOpen' | 'onOpenFullPage' | 'wrap'> & { onClose: () => void }) {
  const value = propertyValue(row, property.property_key);
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [newOptionColor, setNewOptionColor] = useState(PALETTE[1]);
  const [newStatusGroup, setNewStatusGroup] = useState<StatusGroup>('todo');
  const editable = isPropertyEditable(databaseKey, property, row);
  const platform = detectPlatform();

  async function commit(next: unknown = draft, advanceDir?: 1 | -1) {
    if (busy) return;
    setBusy(true);
    const ok = await onChange(row.id, property.property_key, next);
    setBusy(false);
    if (ok) {
      onClose();
      if (advanceDir && onAdvance) onAdvance(advanceDir);
    }
  }

  if (!editable) {
    return (
      <div className="rounded border border-line bg-surface px-2 py-1 text-xs text-muted shadow" onClick={e => e.stopPropagation()}>
        Chỉ đọc
      </div>
    );
  }

  if (property.property_key === 'tags') {
    const selectedIds = Array.isArray(value) ? (value as string[]) : [];
    const filteredTags = tags.filter(t => t.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
    const canCreateTag = query.trim().length > 0 && !tags.some(t => t.name.toLocaleLowerCase('vi') === query.trim().toLocaleLowerCase('vi'));

    async function handleCreateTag() {
      const name = query.trim();
      if (!name || busy) return;
      setBusy(true);
      const res = await saveTagOption({ name, color: newOptionColor });
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const created: TagOption = {
        id: res.value,
        user_id: '',
        name,
        color: newOptionColor,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onTagCreated?.(created);
      setQuery('');
      await onTag(row.id, created.id, true);
    }

    return (
      <div
        className="dropdown-menu w-64 overflow-hidden"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
          <Search size={13} className="text-muted" />
          <input
            autoFocus
            className="w-full bg-transparent text-xs outline-none"
            placeholder="Tìm hoặc tạo tag..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={event => {
              if (isComposingEvent(event.nativeEvent)) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex(i => Math.min(filteredTags.length - 1, i + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex(i => Math.max(0, i - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (filteredTags[activeIndex]) {
                  const tag = filteredTags[activeIndex];
                  void onTag(row.id, tag.id, !selectedIds.includes(tag.id));
                } else if (canCreateTag) {
                  void handleCreateTag();
                }
              }
            }}
          />
        </div>
        <div className="max-h-48 overflow-auto">
          {filteredTags.map((tag, idx) => (
            <label
              key={tag.id}
              className={`dropdown-item flex cursor-pointer items-center gap-2 px-3.5 py-2 ${idx === activeIndex ? 'bg-[#eef2f6] dark:bg-soft' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(tag.id)}
                onChange={event => void onTag(row.id, tag.id, event.target.checked)}
              />
              <ColoredChip value={tag.name} color={tag.color} />
            </label>
          ))}
          {filteredTags.length === 0 && !canCreateTag && (
            <p className="px-3.5 py-2.5 text-xs text-muted">Nhập tên để tạo tag mới.</p>
          )}
        </div>
        {canCreateTag && (
          <div className="flex items-center gap-1.5 border-t border-line p-2">
            <input
              type="color"
              aria-label="Màu tag mới"
              value={newOptionColor}
              onChange={e => setNewOptionColor(e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border border-line"
            />
            <button type="button" className="btn flex-1 !py-1 text-xs" onClick={() => void handleCreateTag()}>
              + Tạo &quot;{query.trim()}&quot;
            </button>
          </div>
        )}
        <div className="flex justify-end border-t border-line px-3 py-1.5">
          <button type="button" className="text-xs text-muted hover:text-ink" onClick={onClose}>
            Xong
          </button>
        </div>
      </div>
    );
  }

  const optionsFor = options.filter(o => o.property_id === property.id);

  if (property.property_type === 'select' || property.property_type === 'status' || property.property_type === 'relation' || property.property_type === 'multi_select') {
    const isMulti = property.property_type === 'multi_select';
    const isCustomChoice = !property.is_system_property && ['select', 'status', 'multi_select'].includes(property.property_type);
    const target = String(property.configuration.target ?? '');

    type ChoiceItem = { id: string; label: string; color?: string; group?: StatusGroup };
    let allChoices: ChoiceItem[] = [];
    if (property.property_type === 'relation') {
      allChoices = Object.entries(lookups[target] ?? {}).map(([id, name]) => ({ id, label: name }));
    } else if (property.is_system_property && property.property_type === 'status') {
      allChoices = getSystemStatusOptions(databaseKey, property).map(s => ({ id: s.value, label: s.label, color: s.color, group: s.group }));
    } else if (property.is_system_property && property.property_key in SYSTEM_SELECT_CHOICES) {
      allChoices = SYSTEM_SELECT_CHOICES[property.property_key].map(s => ({ id: s.value, label: s.label, color: s.color }));
    } else {
      allChoices = optionsFor.map(o => ({ id: o.id, label: o.label, color: o.color, group: o.status_group }));
    }

    const filteredChoices = allChoices.filter(item =>
      item.label.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))
    );
    const canCreateOption =
      isCustomChoice &&
      query.trim().length > 0 &&
      !optionsFor.some(o => o.label.toLocaleLowerCase('vi') === query.trim().toLocaleLowerCase('vi'));

    const selectedValues = isMulti
      ? (Array.isArray(value) ? (value as string[]) : [])
      : value != null && value !== ''
        ? [String(value)]
        : [];

    async function selectChoice(choiceId: string) {
      if (isMulti) {
        const next = selectedValues.includes(choiceId)
          ? selectedValues.filter(id => id !== choiceId)
          : [...selectedValues, choiceId];
        setBusy(true);
        await onChange(row.id, property.property_key, next);
        setBusy(false);
      } else {
        await commit(choiceId);
      }
    }

    async function handleCreateOption() {
      const text = query.trim();
      if (!text || busy) return;
      setBusy(true);
      const res = await savePropertyOption({
        propertyId: property.id,
        label: text,
        color: newOptionColor,
        position: optionsFor.length,
        statusGroup: newStatusGroup,
      });
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const created: PropertyOption = {
        id: res.value.id,
        user_id: '',
        property_id: property.id,
        label: res.value.label,
        color: res.value.color,
        position: res.value.position,
        status_group: res.value.status_group,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onOptionCreated?.(created);
      setQuery('');
      await selectChoice(created.id);
    }

    const groupedStatus = property.property_type === 'status';

    return (
      <div
        className="dropdown-menu w-64 overflow-hidden"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
          <Search size={13} className="text-muted" />
          <input
            autoFocus
            className="w-full bg-transparent text-xs outline-none"
            aria-label="Tìm lựa chọn"
            placeholder={isCustomChoice ? 'Tìm hoặc thêm lựa chọn...' : 'Tìm lựa chọn...'}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={event => {
              if (isComposingEvent(event.nativeEvent)) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex(i => Math.min(filteredChoices.length - 1, i + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex(i => Math.max(0, i - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (filteredChoices[activeIndex]) {
                  void selectChoice(filteredChoices[activeIndex].id);
                } else if (canCreateOption) {
                  void handleCreateOption();
                }
              }
            }}
          />
        </div>
        <div className="max-h-56 overflow-auto">
          {!isMulti && (
            <button
              type="button"
              className="dropdown-item block w-full px-3.5 py-2 text-left text-xs text-muted"
              onClick={() => void commit('')}
            >
              — Xóa giá trị
            </button>
          )}
          {groupedStatus
            ? STATUS_GROUP_ORDER.map(group => {
              const items = filteredChoices.filter(c => (c.group ?? 'todo') === group);
              if (!items.length) return null;
              return (
                <div key={group} className="border-t border-line first:border-t-0">
                  <p className="bg-soft/60 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {STATUS_GROUP_LABELS[group]}
                  </p>
                  {items.map(item => {
                    const idx = filteredChoices.indexOf(item);
                    const checked = selectedValues.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`dropdown-item flex w-full items-center justify-between px-3.5 py-2 text-left text-xs ${idx === activeIndex ? 'bg-[#eef2f6] dark:bg-soft' : ''}`}
                        onClick={() => void selectChoice(item.id)}
                      >
                        <ColoredChip value={item.label} color={item.color} />
                        {checked && <span className="text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })
            : filteredChoices.map((item, idx) => {
              const checked = selectedValues.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`dropdown-item flex w-full items-center justify-between px-3.5 py-2 text-left text-xs ${idx === activeIndex ? 'bg-[#eef2f6] dark:bg-soft' : ''}`}
                  onClick={() => void selectChoice(item.id)}
                >
                  {item.color || property.property_type !== 'relation' ? (
                    <ColoredChip value={item.label} color={item.color} />
                  ) : (
                    <span className="truncate">{item.label}</span>
                  )}
                  {checked && <span className="text-xs">✓</span>}
                </button>
              );
            })}
          {filteredChoices.length === 0 && !canCreateOption && (
            <p className="px-3.5 py-2.5 text-xs text-muted">Không có lựa chọn phù hợp.</p>
          )}
        </div>
        {canCreateOption && (
          <div className="space-y-1.5 border-t border-line p-2">
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                aria-label="Màu lựa chọn mới"
                value={newOptionColor}
                onChange={e => setNewOptionColor(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-line"
              />
              {property.property_type === 'status' && (
                <SelectDropdown
                  size="xs"
                  aria-label="Nhóm trạng thái"
                  value={newStatusGroup}
                  onChange={val => setNewStatusGroup(val as StatusGroup)}
                  options={STATUS_GROUP_ORDER.map(g => ({ value: g, label: STATUS_GROUP_LABELS[g] }))}
                />
              )}
            </div>
            <button type="button" className="btn w-full !py-1 text-xs" onClick={() => void handleCreateOption()}>
              + Tạo &quot;{query.trim()}&quot;
            </button>
          </div>
        )}
        {isMulti && (
          <div className="flex justify-end border-t border-line px-3 py-1.5">
            <button type="button" className="text-xs text-muted hover:text-ink" onClick={onClose}>
              Xong
            </button>
          </div>
        )}
      </div>
    );
  }

  if (property.property_type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 rounded bg-surface p-1.5 text-xs shadow" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          type="checkbox"
          checked={Boolean(value)}
          onChange={event => void commit(event.target.checked)}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              onClose();
            }
          }}
        />
        Đánh dấu
      </label>
    );
  }

  if (property.property_type === 'currency') {
    return (
      <MoneyInput
        autoFocus
        showCurrencySuffix={false}
        allowNegative={property.property_key === 'opening_balance' || !property.is_system_property}
        className="min-w-40 !py-1"
        value={draft}
        onValueChange={setDraft}
        onBlur={() => void commit()}
        onKeyDown={event => {
          if (isComposingEvent(event.nativeEvent)) return;
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            void commit(draft, event.shiftKey ? -1 : 1);
            return;
          }
          if (event.key === 'Enter' || matchShortcut(event.nativeEvent, { key: 'Enter', mod: true }, platform)) {
            event.preventDefault();
            event.stopPropagation();
            void commit();
          }
        }}
      />
    );
  }

  const inputType =
    property.property_type === 'date'
      ? 'date'
      : property.property_type === 'number'
        ? 'number'
        : property.property_type === 'url'
          ? 'url'
          : 'text';

  return (
    <input
      autoFocus
      className="input min-w-40 !py-1"
      type={inputType}
      step={inputType === 'number' ? '0.01' : undefined}
      value={draft}
      onChange={event => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={event => {
        if (isComposingEvent(event.nativeEvent)) return;
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
          return;
        }
        if (event.key === 'Tab') {
          event.preventDefault();
          event.stopPropagation();
          void commit(draft, event.shiftKey ? -1 : 1);
          return;
        }
        if (event.key === 'Enter' || matchShortcut(event.nativeEvent, { key: 'Enter', mod: true }, platform)) {
          event.preventDefault();
          event.stopPropagation();
          void commit();
        }
      }}
    />
  );
}

export function DatabaseCell(props: CellProps) {
  const [editing, setEditing] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const title = props.property.property_key === databaseConfig[props.databaseKey].titleKey;
  const editable = isPropertyEditable(props.databaseKey, props.property, props.row);

  function closeAndFocusCell() {
    setEditing(false);
    const td = cellRef.current?.closest('td');
    if (td instanceof HTMLElement) td.focus();
  }

  return (
    <div
      ref={cellRef}
      className="group/cell relative min-h-6"
      onDoubleClick={event => {
        event.stopPropagation();
        if (editable) setEditing(true);
      }}
    >
      {editing ? (
        <div className="relative z-30">
          <PropertyEditor
            key={props.row.id + props.property.id}
            databaseKey={props.databaseKey}
            row={props.row}
            property={props.property}
            options={props.options}
            tags={props.tags}
            lookups={props.lookups}
            onChange={props.onChange}
            onTag={props.onTag}
            onOptionCreated={props.onOptionCreated}
            onTagCreated={props.onTagCreated}
            onAdvance={props.onAdvance}
            onClose={closeAndFocusCell}
          />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-cell-trigger="true"
            className={`min-w-0 flex-1 text-left ${props.wrap ? 'whitespace-normal break-words' : 'truncate whitespace-nowrap'} ${title ? 'font-medium hover:underline' : ''}`}
            onClick={() => {
              if (title) props.onOpen(props.row.id);
              else if (editable) setEditing(true);
            }}
          >
            {formatPropertyCell(props.databaseKey, props.row, props.property, props.lookups, props.options, props.tags)}
          </button>
          {title && props.onOpenFullPage && (
            <button
              type="button"
              title="Mở thành trang"
              aria-label="Mở thành trang"
              className="shrink-0 rounded px-1 py-0.5 text-[11px] text-muted opacity-0 hover:bg-soft hover:text-ink group-hover/cell:opacity-100 focus:opacity-100"
              onClick={event => {
                event.stopPropagation();
                props.onOpenFullPage?.(props.row.id);
              }}
            >
              <ExternalLink size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PropertyMenu({
  databaseKey,
  property,
  onSaved,
  onHide,
  onInsert,
}: {
  databaseKey: DatabaseKey;
  property: DatabaseProperty;
  onSaved: () => void;
  onHide: (propertyKey: string) => void;
  onInsert: (position: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(property.property_name);
  const [type, setType] = useState<PropertyType>(property.property_type);
  const [expression, setExpression] = useState(String(property.configuration.expression ?? ''));
  const [formulaFormat, setFormulaFormat] = useState(String(property.configuration.format ?? 'number'));
  const [statusEdits, setStatusEdits] = useState<StatusMeta[]>(() =>
    property.is_system_property && property.property_type === 'status'
      ? getSystemStatusOptions(databaseKey, property)
      : []
  );
  const [editingStatuses, setEditingStatuses] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target) ||
        target?.closest?.('[data-dropdown-portal="true"]')
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('[data-dropdown-portal="true"]')) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function save(overrides: Partial<{ name: string; type: PropertyType; visible: boolean; position: number; configuration: Record<string, unknown> }> = {}) {
    const nextType = overrides.type ?? type;
    if (
      nextType !== property.property_type &&
      !window.confirm('Đổi kiểu thuộc tính? Dữ liệu hiện có sẽ được kiểm tra và chuyển đổi an toàn; thao tác không tương thích sẽ bị từ chối.')
    ) {
      return;
    }
    const nextConfig: Record<string, unknown> = { ...(overrides.configuration ?? property.configuration) };
    if (!property.is_system_property && nextType === 'formula') {
      nextConfig.expression = expression;
      nextConfig.format = formulaFormat;
    }
    if (property.is_system_property && property.property_type === 'status' && statusEdits.length) {
      nextConfig.status_options = Object.fromEntries(
        statusEdits.map(s => [s.value, { label: s.label, color: s.color, group: s.group }])
      );
    }
    const result = await saveDatabaseProperty({
      id: property.id,
      databaseKey,
      name: overrides.name ?? name,
      type: nextType,
      visible: overrides.visible ?? property.is_visible,
      position: overrides.position ?? property.position,
      configuration: nextConfig,
    });
    if (result.ok) {
      setOpen(false);
      onSaved();
      toast.success('Đã lưu thuộc tính');
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        className="rounded p-0.5 opacity-60 hover:bg-soft hover:opacity-100"
        aria-label={`Tùy chỉnh ${property.property_name}`}
        onClick={event => {
          event.stopPropagation();
          if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const width = 288;
            const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
            const top = Math.max(12, Math.min(rect.bottom + 6, Math.max(12, window.innerHeight - 480)));
            setCoords({ top, left });
          }
          setOpen(!open);
        }}
      >
        <ChevronDown size={14} />
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: coords.top, left: coords.left, maxHeight: `calc(100vh - ${coords.top + 12}px)` }}
            className="dropdown-menu fixed z-50 w-72 overflow-auto p-2.5 text-ink"
            onClick={event => event.stopPropagation()}
          >
            <label className="meta block">
              Đổi tên
              <input
                className="input mt-1 !py-1.5"
                value={name}
                onChange={event => setName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !isComposingEvent(event.nativeEvent)) void save({ name });
                }}
              />
            </label>
            <div className="meta mt-2 block">
              <span>Kiểu</span>
              <SelectDropdown
                size="sm"
                className="mt-1"
                aria-label="Kiểu thuộc tính"
                disabled={property.is_system_property}
                value={type}
                onChange={val => setType(val as PropertyType)}
                options={Object.entries(typeLabels)
                  .filter(([v]) => !['created_time', 'last_edited_time'].includes(v) || v === property.property_type)
                  .map(([value, labelText]) => ({ value, label: labelText }))}
              />
            </div>
            {!property.is_system_property && type === 'formula' && (
              <div className="mt-2 space-y-1.5">
                <label className="meta block">
                  Biểu thức công thức
                  <input
                    className="input mt-1 !py-1 font-mono text-xs"
                    placeholder="VD: {budget_amount} - {actual_spending}"
                    value={expression}
                    onChange={e => setExpression(e.target.value)}
                  />
                </label>
                <div className="meta block">
                  <span>Định dạng</span>
                  <SelectDropdown
                    size="xs"
                    className="mt-1"
                    aria-label="Định dạng công thức"
                    value={formulaFormat}
                    onChange={setFormulaFormat}
                    options={[
                      { value: 'number', label: 'Số' },
                      { value: 'currency', label: 'Tiền tệ (₫)' },
                      { value: 'percent', label: 'Phần trăm (%)' },
                      { value: 'text', label: 'Văn bản' },
                    ]}
                  />
                </div>
              </div>
            )}
            {property.is_system_property && property.property_type === 'status' && (
              <div className="mt-2 border-t border-line pt-2">
                <button
                  type="button"
                  className="text-xs font-medium text-ink underline"
                  onClick={() => setEditingStatuses(!editingStatuses)}
                >
                  {editingStatuses ? 'Ẩn cấu hình trạng thái' : 'Tùy chỉnh nhãn, màu & nhóm trạng thái'}
                </button>
                {editingStatuses && (
                  <div className="mt-2 max-h-48 space-y-1.5 overflow-auto">
                    {statusEdits.map((item, idx) => (
                      <div key={item.value} className="grid grid-cols-[24px_1fr_98px] items-center gap-1">
                        <input
                          type="color"
                          aria-label={`Màu ${item.value}`}
                          value={item.color}
                          onChange={e =>
                            setStatusEdits(curr => curr.map((s, i) => (i === idx ? { ...s, color: e.target.value } : s)))
                          }
                          className="h-6 w-6 cursor-pointer rounded border border-line"
                        />
                        <input
                          className="input !px-1.5 !py-0.5 text-xs"
                          aria-label={`Nhãn ${item.value}`}
                          value={item.label}
                          onChange={e =>
                            setStatusEdits(curr => curr.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s)))
                          }
                        />
                        <SelectDropdown
                          size="xs"
                          aria-label={`Nhóm ${item.value}`}
                          value={item.group}
                          onChange={val =>
                            setStatusEdits(curr =>
                              curr.map((s, i) => (i === idx ? { ...s, group: val as StatusGroup } : s))
                            )
                          }
                          options={[
                            { value: 'todo', label: 'To-do' },
                            { value: 'in_progress', label: 'In Progress' },
                            { value: 'complete', label: 'Complete' },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button type="button" className="btn btn-primary mt-2.5 w-full !py-1 text-xs" onClick={() => void save()}>
              Lưu thuộc tính
            </button>
            <div className="mt-2 border-t border-line pt-1 text-xs">
              <button
                type="button"
                className="block w-full rounded px-2 py-1 text-left hover:bg-soft"
                onClick={() => {
                  setOpen(false);
                  onInsert(property.position);
                }}
              >
                Chèn cột bên trái
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1 text-left hover:bg-soft"
                onClick={() => {
                  setOpen(false);
                  onInsert(property.position + 1);
                }}
              >
                Chèn cột bên phải
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1 text-left hover:bg-soft"
                onClick={() => {
                  setOpen(false);
                  onHide(property.property_key);
                }}
              >
                Ẩn thuộc tính
              </button>
              {!property.is_system_property && (
                <>
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1 text-left hover:bg-soft"
                    onClick={async () => {
                      const result = await saveDatabaseProperty({
                        databaseKey,
                        name: `${property.property_name} (bản sao)`,
                        type: property.property_type,
                        visible: true,
                        position: property.position + 1,
                        configuration: property.configuration,
                      });
                      if (result.ok) {
                        setOpen(false);
                        onSaved();
                      } else toast.error(result.error);
                    }}
                  >
                    Nhân bản thuộc tính
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1 text-left text-red-600 hover:bg-soft"
                    onClick={async () => {
                      if (!window.confirm(`Xóa thuộc tính ${property.property_name} và dữ liệu của nó?`)) return;
                      const result = await deleteDatabaseProperty(databaseKey, property.id);
                      if (result.ok) {
                        setOpen(false);
                        onSaved();
                      } else toast.error(result.error);
                    }}
                  >
                    Xóa thuộc tính
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export function DatabaseColumnHeader({
  property,
  width,
  onResize,
  onMove,
  onSaved,
  onHide,
  onInsert,
  databaseKey,
}: {
  property: DatabaseProperty;
  width: number;
  onResize: (width: number) => void;
  onMove: (from: string, to: string) => void;
  onSaved: () => void;
  onHide: (propertyKey: string) => void;
  onInsert: (position: number) => void;
  databaseKey: DatabaseKey;
}) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const activeWidth = liveWidth ?? width;

  return (
    <th
      draggable={liveWidth === null}
      onDragStart={event => event.dataTransfer.setData('text/plain', property.property_key)}
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault();
        const from = event.dataTransfer.getData('text/plain');
        if (from) onMove(from, property.property_key);
      }}
      className="sticky top-0 z-[2] border-b border-line bg-soft px-3 py-2 text-left text-xs font-semibold text-muted"
      style={{ width: activeWidth, minWidth: activeWidth }}
    >
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate">{property.property_name}</span>
        <PropertyMenu databaseKey={databaseKey} property={property} onSaved={onSaved} onHide={onHide} onInsert={onInsert} />
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={`Đổi độ rộng cột ${property.property_name}`}
          className="cursor-col-resize touch-none px-1 text-muted/50 hover:text-ink"
          title="Kéo để đổi độ rộng"
          onPointerDown={event => {
            event.preventDefault();
            event.stopPropagation();
            start.current = { x: event.clientX, width };
            setLiveWidth(width);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            if (!start.current) return;
            setLiveWidth(Math.max(80, Math.min(800, Math.round(start.current.width + event.clientX - start.current.x))));
          }}
          onPointerUp={event => {
            if (start.current) {
              const next = Math.max(80, Math.min(800, Math.round(start.current.width + event.clientX - start.current.x)));
              start.current = null;
              setLiveWidth(null);
              if (next !== width) onResize(next);
            }
          }}
        >
          <GripVertical size={12} />
        </span>
      </div>
    </th>
  );
}

export function DatabaseRow({
  row,
  children,
  selected,
  onSelect,
  onOpen,
  onOpenFullPage,
  onDuplicate,
  onDelete,
  onDragRow,
}: {
  row: DataRow;
  children: React.ReactNode;
  selected: boolean;
  onSelect: (shift: boolean) => void;
  onOpen: () => void;
  onOpenFullPage: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDragRow: (from: string, to: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <tr
      data-row-id={row.id}
      className={`group border-t border-line hover:bg-soft/50 ${selected ? 'bg-soft/70' : ''}`}
      draggable
      onDragStart={event => event.dataTransfer.setData('application/x-row', row.id)}
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        const from = event.dataTransfer.getData('application/x-row');
        if (from) onDragRow(from, row.id);
      }}
    >
      <td className="w-9 min-w-9 px-2 py-2">
        <input
          type="checkbox"
          aria-label={`Chọn ${row.id}`}
          checked={selected}
          onChange={event => onSelect((event.nativeEvent as MouseEvent).shiftKey)}
        />
      </td>
      {children}
      <td className="w-10 px-1 py-2">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            className="rounded p-1 text-muted opacity-0 hover:bg-soft group-hover:opacity-100 focus:opacity-100"
            aria-label="Thao tác hàng"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="dropdown-menu absolute right-0 top-7 z-30 w-40 overflow-hidden">
              <button
                type="button"
                className="dropdown-item block w-full px-3.5 py-2 text-left text-xs"
                onClick={() => {
                  setMenuOpen(false);
                  onOpen();
                }}
              >
                Xem nhanh
              </button>
              <button
                type="button"
                className="dropdown-item block w-full px-3.5 py-2 text-left text-xs"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenFullPage();
                }}
              >
                Mở thành trang
              </button>
              <button
                type="button"
                className="dropdown-item block w-full px-3.5 py-2 text-left text-xs"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
              >
                Nhân bản
              </button>
              <button
                type="button"
                className="dropdown-item block w-full px-3.5 py-2 text-left text-xs text-red-600"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                Xóa
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export function DatabaseTableSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <div className="table-wrap p-4">
      <div className="space-y-3">
        <div className="h-8 rounded bg-soft" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((__, j) => (
              <div key={j} className="h-6 rounded bg-soft/70" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DatabaseTable({
  databaseKey,
  rows,
  properties,
  allProperties,
  options,
  tags,
  lookups,
  widths,
  wrap,
  selected,
  onSelect,
  onSelectAll,
  onChange,
  onTag,
  onOptionCreated,
  onTagCreated,
  onOpen,
  onOpenFullPage,
  onDuplicate,
  onDelete,
  onMoveColumn,
  onResize,
  onMoveRow,
  onRefresh,
  onHideProperty,
  onInsert,
  groupBy,
}: {
  databaseKey: DatabaseKey;
  rows: DataRow[];
  properties: DatabaseProperty[];
  allProperties: DatabaseProperty[];
  options: PropertyOption[];
  tags: TagOption[];
  lookups: Record<string, Record<string, string>>;
  widths: Record<string, number>;
  wrap: boolean;
  selected: Set<string>;
  onSelect: (id: string, shift: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onChange: CellProps['onChange'];
  onTag: CellProps['onTag'];
  onOptionCreated: (option: PropertyOption) => void;
  onTagCreated: (tag: TagOption) => void;
  onOpen: (id: string) => void;
  onOpenFullPage: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveColumn: (from: string, to: string) => void;
  onResize: (key: string, width: number) => void;
  onMoveRow: (from: string, to: string) => void;
  onRefresh: () => void;
  onHideProperty: (propertyKey: string) => void;
  onInsert: (position: number) => void;
  groupBy: string | null;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const platform = detectPlatform();

  function moveFocusFromCell(currentTd: HTMLElement, direction: 1 | -1, editableOnly: boolean) {
    const tableEl = tableRef.current;
    if (!tableEl) return;
    const selector = editableOnly ? 'tbody td[data-row][data-editable="true"]' : 'tbody td[data-row]';
    const all = [...tableEl.querySelectorAll<HTMLElement>(selector)];
    const idx = all.indexOf(currentTd);
    if (idx < 0) return;
    const target = all[idx + direction];
    if (target) {
      target.focus();
      if (editableOnly) {
        const btn = target.querySelector<HTMLElement>('[data-cell-trigger="true"]');
        if (btn) btn.click();
      }
    }
  }

  const groupProperty = useMemo(
    () => (groupBy ? allProperties.find(p => p.property_key === groupBy) : undefined),
    [groupBy, allProperties]
  );

  // Bucket rows cleanly when groupBy is active so identical groups stay together
  const orderedRows = useMemo(() => {
    if (!groupBy) return rows;
    const buckets = new Map<string, DataRow[]>();
    if (groupProperty?.is_system_property && groupProperty.property_type === 'status') {
      for (const s of getSystemStatusOptions(databaseKey, groupProperty)) {
        buckets.set(s.value, []);
      }
    }
    for (const row of rows) {
      const val = propertyValue(row, groupBy);
      const bucketKey = val == null || val === '' ? '__empty__' : String(val);
      const list = buckets.get(bucketKey);
      if (list) list.push(row);
      else buckets.set(bucketKey, [row]);
    }
    const result: DataRow[] = [];
    for (const list of buckets.values()) {
      for (const item of list) result.push(item);
    }
    return result;
  }, [rows, groupBy, groupProperty, databaseKey]);

  const groupMetaByIndex = useMemo(() => {
    if (!groupBy) return new Map<number, { label: string; color?: string; count: number }>();
    const counts = new Map<string, number>();
    const keys = orderedRows.map(r => {
      const val = propertyValue(r, groupBy);
      const k = val == null || val === '' ? '__empty__' : String(val);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      return k;
    });
    const map = new Map<number, { label: string; color?: string; count: number }>();
    keys.forEach((k, idx) => {
      if (idx === 0 || keys[idx - 1] !== k) {
        if (k === '__empty__') {
          map.set(idx, { label: 'Chưa có', count: counts.get(k) ?? 0 });
        } else if (groupProperty?.property_type === 'relation') {
          const target = String(groupProperty.configuration.target ?? '');
          map.set(idx, { label: lookups[target]?.[k] ?? k, count: counts.get(k) ?? 0 });
        } else if (groupProperty?.property_type === 'date') {
          map.set(idx, { label: dateVN(k), count: counts.get(k) ?? 0 });
        } else if (groupProperty) {
          const resolved = resolveStatusOrSelectDisplay(databaseKey, groupProperty, k, options);
          map.set(idx, { label: resolved.label, color: resolved.color, count: counts.get(k) ?? 0 });
        } else {
          map.set(idx, { label: label(k), count: counts.get(k) ?? 0 });
        }
      }
    });
    return map;
  }, [groupBy, orderedRows, groupProperty, lookups, databaseKey, options]);

  return (
    <div className="table-wrap max-h-[70vh] overflow-auto">
      <table ref={tableRef} className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 z-[3] w-9 border-b border-line bg-soft px-2 py-2">
              <input
                aria-label="Chọn tất cả"
                type="checkbox"
                checked={orderedRows.length > 0 && orderedRows.every(row => selected.has(row.id))}
                onChange={event => onSelectAll(event.target.checked)}
              />
            </th>
            {properties.map(property => (
              <DatabaseColumnHeader
                key={property.id}
                databaseKey={databaseKey}
                property={property}
                width={widths[property.property_key] ?? 180}
                onResize={width => onResize(property.property_key, width)}
                onMove={onMoveColumn}
                onSaved={onRefresh}
                onHide={onHideProperty}
                onInsert={onInsert}
              />
            ))}
            <th className="sticky top-0 z-[3] w-10 border-b border-line bg-soft" />
          </tr>
        </thead>
        <tbody>
          {orderedRows.map((row, rowIndex) => {
            const groupHeader = groupMetaByIndex.get(rowIndex) ?? null;
            return (
              <FragmentRow key={row.id} group={groupHeader} colSpan={properties.length + 2}>
                <DatabaseRow
                  row={row}
                  selected={selected.has(row.id)}
                  onSelect={shift => onSelect(row.id, shift)}
                  onOpen={() => onOpen(row.id)}
                  onOpenFullPage={() => onOpenFullPage(row.id)}
                  onDuplicate={() => onDuplicate(row.id)}
                  onDelete={() => onDelete(row.id)}
                  onDragRow={onMoveRow}
                >
                  {properties.map((prop, index) => {
                    const editable = isPropertyEditable(databaseKey, prop, row);
                    const cellWidth = widths[prop.property_key] ?? 180;
                    return (
                      <td
                        key={prop.id}
                        data-row={row.id}
                        data-col={index}
                        data-prop={prop.property_key}
                        data-editable={editable ? 'true' : 'false'}
                        tabIndex={0}
                        className="max-w-0 border-l border-line/60 px-3 py-2 align-middle focus:bg-soft focus:outline-none focus:ring-1 focus:ring-inset focus:ring-muted"
                        style={{ width: cellWidth, minWidth: cellWidth }}
                        onKeyDown={event => {
                          if (isComposingEvent(event.nativeEvent)) return;
                          if ((event.target as HTMLElement).closest('input,select,textarea')) return;
                          if (matchShortcut(event.nativeEvent, { key: 'Enter', mod: true }, platform)) {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenFullPage(row.id);
                            return;
                          }
                          if (matchShortcut(event.nativeEvent, { key: 'd', mod: true }, platform)) {
                            event.preventDefault();
                            event.stopPropagation();
                            onDuplicate(row.id);
                            return;
                          }
                          if (event.key === 'Tab') {
                            event.preventDefault();
                            moveFocusFromCell(event.currentTarget, event.shiftKey ? -1 : 1, false);
                            return;
                          }
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            const btn = event.currentTarget.querySelector<HTMLElement>('[data-cell-trigger="true"]');
                            btn?.click();
                            return;
                          }
                          if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                            event.preventDefault();
                            const all = [...(tableRef.current?.querySelectorAll<HTMLElement>('tbody td[data-row]') ?? [])];
                            const i = all.indexOf(event.currentTarget);
                            const next =
                              event.key === 'ArrowRight'
                                ? i + 1
                                : event.key === 'ArrowLeft'
                                  ? i - 1
                                  : event.key === 'ArrowDown'
                                    ? i + properties.length
                                    : i - properties.length;
                            all[next]?.focus();
                          }
                        }}
                      >
                        <DatabaseCell
                          databaseKey={databaseKey}
                          row={row}
                          property={prop}
                          options={options}
                          tags={tags}
                          lookups={lookups}
                          wrap={wrap}
                          onChange={onChange}
                          onTag={onTag}
                          onOptionCreated={onOptionCreated}
                          onTagCreated={onTagCreated}
                          onOpen={onOpen}
                          onOpenFullPage={onOpenFullPage}
                          onAdvance={direction => {
                            const td = tableRef.current?.querySelector<HTMLElement>(
                              `tbody td[data-row="${row.id}"][data-prop="${prop.property_key}"]`
                            );
                            if (td) moveFocusFromCell(td, direction, true);
                          }}
                        />
                      </td>
                    );
                  })}
                </DatabaseRow>
              </FragmentRow>
            );
          })}
        </tbody>
      </table>
      {orderedRows.length === 0 && (
        <div className="p-10 text-center text-muted">Chưa có bản ghi phù hợp.</div>
      )}
    </div>
  );
}

function FragmentRow({
  group,
  colSpan,
  children,
}: {
  group: { label: string; color?: string; count: number } | null;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {group !== null && (
        <tr>
          <td colSpan={colSpan} className="border-t border-line bg-soft/90 px-3 py-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-2">
              {group.color ? <ColoredChip value={group.label} color={group.color} /> : <span>{group.label}</span>}
              <span className="text-muted">({group.count})</span>
            </span>
          </td>
        </tr>
      )}
      {children}
    </>
  );
}
