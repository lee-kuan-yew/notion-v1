'use client';
import { useEffect, useRef, useState } from 'react';
import { Filter, ArrowDownUp, Layers, Columns3, Plus, Tag, Search, Calendar, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { SelectDropdown } from '@/components/ui/dropdown';
import { MoneyInput } from '@/components/ui/money-input';
import { filterSchema, sortsSchema, type FilterSet, type SortRule } from '../rules';
import { typeLabels } from './database-table';
import {
  STATUS_GROUP_LABELS,
  STATUS_GROUP_ORDER,
  SYSTEM_SELECT_CHOICES,
  getSystemStatusOptions,
  type StatusMeta,
} from '../status';
import {
  deletePropertyOption,
  deleteTagOption,
  saveDatabaseProperty,
  savePropertyOption,
  saveTagOption,
} from '../actions';
import type {
  DatabaseKey,
  DatabaseProperty,
  DatabaseView,
  PropertyOption,
  PropertyType,
  StatusGroup,
  TagOption,
} from '@/types/database';

export type ViewPatch = {
  filters?: FilterSet;
  sorts?: SortRule[];
  group_by?: string | null;
  visible_properties?: string[];
  column_widths?: Record<string, number>;
  column_order?: string[];
  configuration?: Record<string, unknown>;
  view_name?: string;
};

type ControlProps = {
  databaseKey: DatabaseKey;
  view: DatabaseView;
  views: DatabaseView[];
  properties: DatabaseProperty[];
  options: PropertyOption[];
  tags: TagOption[];
  lookups: Record<string, Record<string, string>>;
  search: string;
  monthFilter: string;
  saveStatus: 'saved' | 'saving' | 'error';
  onSearch: (value: string) => void;
  onMonthFilter: (value: string) => void;
  onSave: (patch: ViewPatch) => Promise<boolean>;
  onSelect: (id: string) => void;
  onCreate: (name: string, type: 'table' | 'board' | 'calendar') => Promise<void>;
  onDeleteView: () => Promise<void>;
  onAddProperty: (
    name: string,
    type: PropertyType,
    config: Record<string, unknown>
  ) => Promise<void>;
  onRefresh: () => void;
};

const ALL_OPS = [
  ['is', 'Là'],
  ['is_not', 'Không là'],
  ['contains', 'Chứa'],
  ['does_not_contain', 'Không chứa'],
  ['is_empty', 'Rỗng'],
  ['is_not_empty', 'Không rỗng'],
  ['greater_than', 'Lớn hơn'],
  ['less_than', 'Nhỏ hơn'],
  ['before', 'Trước'],
  ['after', 'Sau'],
  ['between', 'Trong khoảng'],
] as const;

function validOpsForType(type?: PropertyType) {
  if (!type) return ALL_OPS;
  if (['number', 'currency', 'formula'].includes(type)) {
    return ALL_OPS.filter(([v]) => ['is', 'is_not', 'is_empty', 'is_not_empty', 'greater_than', 'less_than', 'between'].includes(v));
  }
  if (['date', 'created_time', 'last_edited_time'].includes(type)) {
    return ALL_OPS.filter(([v]) => ['is', 'is_not', 'contains', 'is_empty', 'is_not_empty', 'before', 'after', 'between'].includes(v));
  }
  if (['select', 'status', 'relation', 'checkbox'].includes(type)) {
    return ALL_OPS.filter(([v]) => ['is', 'is_not', 'is_empty', 'is_not_empty'].includes(v));
  }
  if (type === 'multi_select') {
    return ALL_OPS.filter(([v]) => ['is', 'is_not', 'contains', 'does_not_contain', 'is_empty', 'is_not_empty'].includes(v));
  }
  return ALL_OPS.filter(([v]) => ['is', 'is_not', 'contains', 'does_not_contain', 'is_empty', 'is_not_empty'].includes(v));
}

const blankRule = () => ({ key: '', operator: 'is' as const, value: '' as string });

export function FilterBuilder({
  databaseKey,
  view,
  properties,
  options,
  tags,
  lookups,
  onSave,
}: {
  databaseKey: DatabaseKey;
  view: DatabaseView;
  properties: DatabaseProperty[];
  options: PropertyOption[];
  tags: TagOption[];
  lookups: Record<string, Record<string, string>>;
  onSave: ControlProps['onSave'];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = filterSchema.safeParse(view.filters);
  const [filters, setFilters] = useState<FilterSet>(initial.success ? initial.data : { logic: 'and', rules: [] });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-dropdown-portal="true"]')) setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-dropdown-portal="true"]')) return;
      if (ref.current && !ref.current.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  function renderValueInput(rule: FilterSet['rules'][number], index: number) {
    if (['is_empty', 'is_not_empty'].includes(rule.operator)) {
      return <input className="input !py-1.5 text-xs" disabled value="—" aria-label="Giá trị lọc" />;
    }
    const prop = properties.find(p => p.property_key === rule.key);
    const updateVal = (value: string) =>
      setFilters({
        ...filters,
        rules: filters.rules.map((r, i) => (i === index ? { ...r, value } : r)),
      });

    if (prop?.property_key === 'tags') {
      return (
        <SelectDropdown
          size="sm"
          aria-label="Giá trị lọc"
          value={String(rule.value ?? '')}
          onChange={updateVal}
          options={[{ value: '', label: 'Chọn tag' }, ...tags.map(t => ({ value: t.id, label: t.name }))]}
        />
      );
    }
    if (prop?.property_type === 'relation') {
      const entries = Object.entries(lookups[String(prop.configuration.target ?? '')] ?? {});
      return (
        <SelectDropdown
          size="sm"
          aria-label="Giá trị lọc"
          value={String(rule.value ?? '')}
          onChange={updateVal}
          options={[{ value: '', label: 'Chọn mục' }, ...entries.map(([id, name]) => ({ value: id, label: name }))]}
        />
      );
    }
    if (prop?.property_type === 'checkbox') {
      return (
        <SelectDropdown
          size="sm"
          aria-label="Giá trị lọc"
          value={String(rule.value ?? '')}
          onChange={updateVal}
          options={[
            { value: '', label: 'Chọn' },
            { value: 'true', label: 'Đã chọn' },
            { value: 'false', label: 'Chưa chọn' },
          ]}
        />
      );
    }
    if (prop && ['select', 'status', 'multi_select'].includes(prop.property_type)) {
      let choices: { id: string; label: string }[] = [];
      if (prop.is_system_property && prop.property_type === 'status') {
        choices = getSystemStatusOptions(databaseKey, prop).map(s => ({ id: s.value, label: s.label }));
      } else if (prop.is_system_property && prop.property_key in SYSTEM_SELECT_CHOICES) {
        choices = SYSTEM_SELECT_CHOICES[prop.property_key].map(s => ({ id: s.value, label: s.label }));
      } else {
        choices = options.filter(o => o.property_id === prop.id).map(o => ({ id: o.id, label: o.label }));
      }
      if (choices.length) {
        return (
          <SelectDropdown
            size="sm"
            aria-label="Giá trị lọc"
            value={String(rule.value ?? '')}
            onChange={updateVal}
            options={[{ value: '', label: 'Chọn giá trị' }, ...choices.map(c => ({ value: c.id, label: c.label }))]}
          />
        );
      }
    }
    if (prop?.property_type === 'currency') {
      return (
        <MoneyInput
          showCurrencySuffix={false}
          allowNegative
          className="!py-1.5 text-xs"
          aria-label="Giá trị lọc"
          placeholder="100,000"
          value={String(rule.value ?? '')}
          onValueChange={updateVal}
        />
      );
    }
    const type =
      prop && ['date', 'created_time', 'last_edited_time'].includes(prop.property_type) && rule.operator !== 'contains'
        ? 'date'
        : prop && ['number', 'formula'].includes(prop.property_type)
          ? 'number'
          : 'text';
    return (
      <input
        className="input !py-1.5 text-xs"
        type={type}
        aria-label="Giá trị lọc"
        placeholder="Giá trị..."
        value={String(rule.value ?? '')}
        onChange={e => updateVal(e.target.value)}
      />
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="dropdown-trigger inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium"
        onClick={() => setOpen(!open)}
      >
        <Filter size={13} />
        <span>Lọc {filters.rules.length ? `(${filters.rules.length})` : ''}</span>
        <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="dropdown-menu absolute left-0 top-10 z-40 w-[min(92vw,560px)] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span>Khớp</span>
            <SelectDropdown
              size="sm"
              className="!w-36"
              aria-label="Logic lọc"
              value={filters.logic}
              onChange={val => setFilters({ ...filters, logic: val as 'and' | 'or' })}
              options={[
                { value: 'and', label: 'Tất cả (AND)' },
                { value: 'or', label: 'Bất kỳ (OR)' },
              ]}
            />
            <span>điều kiện</span>
          </div>
          {filters.rules.map((rule, index) => {
            const prop = properties.find(p => p.property_key === rule.key);
            const ops = validOpsForType(prop?.property_type);
            const isDate = prop && ['date', 'created_time', 'last_edited_time'].includes(prop.property_type);
            return (
              <div key={index} className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-1.5">
                <SelectDropdown
                  size="sm"
                  aria-label="Thuộc tính lọc"
                  value={rule.key}
                  onChange={nextKey => {
                    const nextProp = properties.find(p => p.property_key === nextKey);
                    const allowed = validOpsForType(nextProp?.property_type);
                    const nextOp = allowed.some(([v]) => v === rule.operator) ? rule.operator : allowed[0][0];
                    setFilters({
                      ...filters,
                      rules: filters.rules.map((r, i) => (i === index ? { ...r, key: nextKey, operator: nextOp, value: '' } : r)),
                    });
                  }}
                  options={[
                    { value: '', label: 'Thuộc tính' },
                    ...properties.map(p => ({ value: p.property_key, label: p.property_name })),
                  ]}
                />
                <SelectDropdown
                  size="sm"
                  aria-label="Điều kiện"
                  value={rule.operator}
                  onChange={val =>
                    setFilters({
                      ...filters,
                      rules: filters.rules.map((r, i) =>
                        i === index ? { ...r, operator: val as typeof rule.operator } : r
                      ),
                    })
                  }
                  options={ops.map(([value, labelText]) => ({ value, label: labelText }))}
                />
                {renderValueInput(rule, index)}
                <button
                  type="button"
                  className="px-2 text-red-600"
                  aria-label="Bỏ điều kiện"
                  onClick={() => setFilters({ ...filters, rules: filters.rules.filter((_, i) => i !== index) })}
                >
                  ×
                </button>
                {rule.operator === 'between' &&
                  (prop?.property_type === 'currency' ? (
                    <MoneyInput
                      showCurrencySuffix={false}
                      allowNegative
                      className="col-start-3 !py-1.5 text-xs"
                      aria-label="Giá trị đến"
                      placeholder="Đến..."
                      value={String(rule.value2 ?? '')}
                      onValueChange={val =>
                        setFilters({
                          ...filters,
                          rules: filters.rules.map((r, i) => (i === index ? { ...r, value2: val } : r)),
                        })
                      }
                    />
                  ) : (
                    <input
                      className="input col-start-3 !py-1.5 text-xs"
                      type={isDate ? 'date' : 'number'}
                      aria-label="Giá trị đến"
                      placeholder="Đến..."
                      value={String(rule.value2 ?? '')}
                      onChange={event =>
                        setFilters({
                          ...filters,
                          rules: filters.rules.map((r, i) => (i === index ? { ...r, value2: event.target.value } : r)),
                        })
                      }
                    />
                  ))}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn !py-1 text-xs"
              onClick={() => setFilters({ ...filters, rules: [...filters.rules, blankRule()] })}
            >
              + Điều kiện
            </button>
            {filters.rules.length > 0 && (
              <button
                type="button"
                className="btn !py-1 text-xs text-muted"
                onClick={async () => {
                  const empty: FilterSet = { logic: 'and', rules: [] };
                  setFilters(empty);
                  if (await onSave({ filters: empty })) setOpen(false);
                }}
              >
                Xóa lọc
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary !py-1 text-xs"
              onClick={async () => {
                if (filters.rules.some(r => !r.key)) {
                  toast.error('Chọn thuộc tính cho mọi điều kiện');
                  return;
                }
                if (await onSave({ filters })) setOpen(false);
              }}
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SortBuilder({
  view,
  properties,
  onSave,
}: {
  view: DatabaseView;
  properties: DatabaseProperty[];
  onSave: ControlProps['onSave'];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = sortsSchema.safeParse(view.sorts);
  const [sorts, setSorts] = useState<SortRule[]>(initial.success ? initial.data : []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-dropdown-portal="true"]')) setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-dropdown-portal="true"]')) return;
      if (ref.current && !ref.current.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="dropdown-trigger inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium"
        onClick={() => setOpen(!open)}
      >
        <ArrowDownUp size={13} />
        <span>Sắp xếp {sorts.length ? `(${sorts.length})` : ''}</span>
        <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="dropdown-menu absolute left-0 top-10 z-40 w-80 p-3">
          {sorts.map((rule, index) => (
            <div key={index} className="mb-2 flex items-center gap-1.5">
              <SelectDropdown
                size="sm"
                aria-label="Thuộc tính sắp xếp"
                value={rule.key}
                onChange={val => setSorts(sorts.map((r, i) => (i === index ? { ...r, key: val } : r)))}
                options={properties.map(p => ({ value: p.property_key, label: p.property_name }))}
              />
              <SelectDropdown
                size="sm"
                className="!w-28 shrink-0"
                aria-label="Chiều sắp xếp"
                value={rule.desc ? 'desc' : 'asc'}
                onChange={val => setSorts(sorts.map((r, i) => (i === index ? { ...r, desc: val === 'desc' } : r)))}
                options={[
                  { value: 'asc', label: 'Tăng' },
                  { value: 'desc', label: 'Giảm' },
                ]}
              />
              <button type="button" className="px-1.5 text-red-600" onClick={() => setSorts(sorts.filter((_, i) => i !== index))}>
                ×
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn !py-1 text-xs"
              onClick={() => setSorts([...sorts, { key: properties[0]?.property_key ?? '', desc: false }])}
            >
              + Sắp xếp
            </button>
            <button
              type="button"
              className="btn btn-primary !py-1 text-xs"
              onClick={async () => {
                if (await onSave({ sorts })) setOpen(false);
              }}
            >
              Lưu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function GroupBuilder({
  view,
  properties,
  onSave,
}: {
  view: DatabaseView;
  properties: DatabaseProperty[];
  onSave: ControlProps['onSave'];
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted">
      <Layers size={14} />
      <SelectDropdown
        size="sm"
        className="!w-40"
        aria-label="Nhóm theo"
        value={view.group_by ?? ''}
        onChange={val => void onSave({ group_by: val || null })}
        options={[
          { value: '', label: 'Không nhóm' },
          ...properties
            .filter(p => ['status', 'select', 'relation', 'date'].includes(p.property_type))
            .map(p => ({ value: p.property_key, label: p.property_name })),
        ]}
      />
    </div>
  );
}

export function ViewSwitcher({
  view,
  views,
  onSelect,
  onCreate,
  onDelete,
}: {
  view: DatabaseView;
  views: DatabaseView[];
  onSelect: ControlProps['onSelect'];
  onCreate: ControlProps['onCreate'];
  onDelete: ControlProps['onDeleteView'];
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'table' | 'board' | 'calendar'>('table');
  return (
    <div className="flex flex-wrap items-center gap-1">
      {views.map(item => (
        <button
          key={item.id}
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm ${item.id === view.id ? 'bg-soft font-semibold text-ink' : 'text-muted hover:bg-soft'}`}
          onClick={() => onSelect(item.id)}
        >
          {item.view_name}
        </button>
      ))}
      <button
        type="button"
        className="rounded p-1.5 text-muted hover:bg-soft"
        aria-label="Thêm view"
        onClick={() => setCreating(!creating)}
      >
        <Plus size={16} />
      </button>
      {creating && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={event => {
            event.preventDefault();
            void onCreate(name, type).then(() => {
              setCreating(false);
              setName('');
            });
          }}
        >
          <input
            className="input !w-32 !py-1 text-xs"
            required
            placeholder="Tên view"
            value={name}
            onChange={event => setName(event.target.value)}
          />
          <SelectDropdown
            size="sm"
            className="!w-28"
            aria-label="Kiểu view mới"
            value={type}
            onChange={val => setType(val as typeof type)}
            options={[
              { value: 'table', label: 'Bảng' },
              { value: 'board', label: 'Board' },
              { value: 'calendar', label: 'Lịch' },
            ]}
          />
          <button className="btn btn-primary !py-1 text-xs">Tạo</button>
        </form>
      )}
      {views.length > 1 && (
        <button
          type="button"
          className="px-2 text-xs text-muted hover:text-red-600"
          onClick={() => {
            if (window.confirm(`Xóa view ${view.view_name}?`)) void onDelete();
          }}
        >
          Xóa view
        </button>
      )}
    </div>
  );
}

export function DatabaseToolbar(props: ControlProps) {
  const {
    databaseKey,
    view,
    views,
    properties,
    options,
    tags,
    lookups,
    search,
    monthFilter,
    saveStatus,
    onSearch,
    onMonthFilter,
    onSave,
    onSelect,
    onCreate,
    onDeleteView,
    onAddProperty,
    onRefresh,
  } = props;
  const [add, setAdd] = useState(false);
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('text');
  const [target, setTarget] = useState('projects');
  const [formulaExpr, setFormulaExpr] = useState('');
  const [formulaFormat, setFormulaFormat] = useState('number');
  const [showColumns, setShowColumns] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#2563EB');

  const visible =
    Array.isArray(view.visible_properties) && view.visible_properties.length
      ? (view.visible_properties as string[])
      : properties.filter(p => p.is_visible).map(p => p.property_key);

  const hasDate = ['transactions', 'budgets', 'projects', 'tasks', 'milestones'].includes(databaseKey);

  return (
    <div className="mb-4 space-y-3 border-b border-line pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewSwitcher view={view} views={views} onSelect={onSelect} onCreate={onCreate} onDelete={onDeleteView} />
        <span className="text-xs text-muted" role="status">
          {saveStatus === 'saving' ? 'Đang lưu…' : saveStatus === 'error' ? 'Lỗi lưu' : 'Đã lưu'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 text-muted" size={14} />
          <input
            className="input h-8 !w-44 !rounded-xl !py-1 !pl-8 text-xs"
            aria-label="Tìm trong bảng"
            placeholder="Tìm trong bảng"
            value={search}
            onChange={event => onSearch(event.target.value)}
          />
        </div>
        {hasDate && (
          <label className="flex items-center gap-1 text-xs text-muted">
            <Calendar size={14} />
            <input
              type="month"
              aria-label="Lọc theo tháng"
              className="input h-8 !w-auto !rounded-xl !py-1 text-xs"
              value={monthFilter}
              onChange={e => onMonthFilter(e.target.value)}
            />
            {monthFilter && (
              <button type="button" className="text-xs underline" onClick={() => onMonthFilter('')}>
                Tất cả
              </button>
            )}
          </label>
        )}
        <FilterBuilder
          key={view.id + 'f'}
          databaseKey={databaseKey}
          view={view}
          properties={properties}
          options={options}
          tags={tags}
          lookups={lookups}
          onSave={onSave}
        />
        <SortBuilder key={view.id + 's'} view={view} properties={properties} onSave={onSave} />
        <GroupBuilder view={view} properties={properties} onSave={onSave} />
        <div className="relative">
          <button
            type="button"
            className="dropdown-trigger inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium"
            onClick={() => setShowColumns(!showColumns)}
          >
            <Columns3 size={13} />
            <span>Cột</span>
            <ChevronDown size={13} className={`transition-transform duration-150 ${showColumns ? 'rotate-180' : ''}`} />
          </button>
          {showColumns && (
            <div className="dropdown-menu absolute left-0 top-10 z-40 max-h-72 w-56 overflow-auto">
              {properties.map(p => (
                <label key={p.id} className="dropdown-item flex cursor-pointer items-center gap-2 px-3.5 py-2">
                  <input
                    type="checkbox"
                    checked={visible.includes(p.property_key)}
                    onChange={event =>
                      void onSave({
                        visible_properties: event.target.checked
                          ? [...new Set([...visible, p.property_key])]
                          : visible.filter(key => key !== p.property_key),
                      })
                    }
                  />
                  <span className="truncate text-xs">{p.property_name}</span>
                </label>
              ))}
              <label className="dropdown-item flex cursor-pointer items-center gap-2 px-3.5 py-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={Boolean((view.configuration as Record<string, unknown>).wrap)}
                  onChange={event =>
                    void onSave({
                      configuration: { ...(view.configuration as Record<string, unknown>), wrap: event.target.checked },
                    })
                  }
                />
                Xuống dòng trong ô
              </label>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            className="dropdown-trigger inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium"
            onClick={() => setAdd(!add)}
          >
            <Plus size={13} />
            <span>Thuộc tính</span>
            <ChevronDown size={13} className={`transition-transform duration-150 ${add ? 'rotate-180' : ''}`} />
          </button>
          {add && (
            <form
              className="dropdown-menu absolute left-0 top-10 z-40 w-72 space-y-2 p-3"
              onSubmit={event => {
                event.preventDefault();
                const cfg: Record<string, unknown> =
                  propertyType === 'relation'
                    ? { target }
                    : propertyType === 'formula'
                      ? { expression: formulaExpr, format: formulaFormat }
                      : {};
                void onAddProperty(propertyName, propertyType, cfg).then(() => {
                  setAdd(false);
                  setPropertyName('');
                  setFormulaExpr('');
                });
              }}
            >
              <input
                className="input"
                placeholder="Tên thuộc tính"
                required
                value={propertyName}
                onChange={event => setPropertyName(event.target.value)}
              />
              <SelectDropdown
                size="sm"
                aria-label="Kiểu thuộc tính mới"
                value={propertyType}
                onChange={val => setPropertyType(val as PropertyType)}
                options={Object.entries(typeLabels)
                  .filter(([value]) => !['created_time', 'last_edited_time'].includes(value))
                  .map(([value, labelText]) => ({ value, label: labelText }))}
              />
              {propertyType === 'relation' && (
                <SelectDropdown
                  size="sm"
                  aria-label="Bảng liên kết"
                  value={target}
                  onChange={setTarget}
                  options={['projects', 'tasks', 'accounts', 'categories', 'transactions', 'budgets', 'milestones'].map(
                    key => ({ value: key, label: key })
                  )}
                />
              )}
              {propertyType === 'formula' && (
                <div className="space-y-1.5">
                  <input
                    className="input font-mono text-xs"
                    required
                    placeholder="VD: {budget_amount} - {actual_spending}"
                    value={formulaExpr}
                    onChange={e => setFormulaExpr(e.target.value)}
                  />
                  <SelectDropdown
                    size="xs"
                    aria-label="Định dạng công thức mới"
                    value={formulaFormat}
                    onChange={setFormulaFormat}
                    options={[
                      { value: 'number', label: 'Định dạng: Số' },
                      { value: 'currency', label: 'Định dạng: Tiền tệ (₫)' },
                      { value: 'percent', label: 'Định dạng: Phần trăm (%)' },
                      { value: 'text', label: 'Định dạng: Văn bản' },
                    ]}
                  />
                  <p className="text-[11px] text-muted">
                    Biến khả dụng:{' '}
                    {properties
                      .filter(p => !(p.property_type === 'formula' && !p.is_system_property))
                      .map(p => `{${p.property_key}}`)
                      .join(', ')}
                  </p>
                </div>
              )}
              <button className="btn btn-primary w-full">Tạo thuộc tính</button>
            </form>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            className="dropdown-trigger inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium"
            onClick={() => setShowTags(!showTags)}
          >
            <Tag size={13} />
            <span>Tags</span>
            <ChevronDown size={13} className={`transition-transform duration-150 ${showTags ? 'rotate-180' : ''}`} />
          </button>
          {showTags && (
            <div className="dropdown-menu absolute left-0 top-10 z-40 w-72 p-3">
              <form
                className="mb-2 flex items-center gap-1"
                onSubmit={async event => {
                  event.preventDefault();
                  const result = await saveTagOption({ name: tagName, color: tagColor });
                  if (result.ok) {
                    setTagName('');
                    onRefresh();
                    toast.success('Đã tạo tag');
                  } else toast.error(result.error);
                }}
              >
                <input
                  type="color"
                  aria-label="Màu tag mới"
                  value={tagColor}
                  onChange={e => setTagColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-line"
                />
                <input
                  className="input !py-1.5"
                  required
                  placeholder="Tag mới"
                  value={tagName}
                  onChange={event => setTagName(event.target.value)}
                />
                <button className="btn !py-1.5">+</button>
              </form>
              <div className="max-h-48 overflow-auto">
                {tags.map(tag => (
                  <TagEditor key={tag.id} tag={tag} onRefresh={onRefresh} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <OptionManager databaseKey={databaseKey} properties={properties} options={options} onRefresh={onRefresh} />
    </div>
  );
}

function TagEditor({ tag, onRefresh }: { tag: TagOption; onRefresh: () => void }) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  return (
    <div className="mb-1 flex items-center gap-1">
      <input aria-label="Màu tag" type="color" value={color} onChange={event => setColor(event.target.value)} />
      <input className="input !py-1 text-xs" aria-label="Tên tag" value={name} onChange={event => setName(event.target.value)} />
      <button
        type="button"
        className="text-xs underline"
        onClick={async () => {
          const result = await saveTagOption({ id: tag.id, name, color });
          if (result.ok) {
            onRefresh();
            toast.success('Đã cập nhật tag');
          } else toast.error(result.error);
        }}
      >
        Lưu
      </button>
      <button
        type="button"
        className="text-xs text-red-600"
        aria-label={`Xóa tag ${tag.name}`}
        onClick={async () => {
          if (!window.confirm(`Xóa tag ${tag.name}? Bản ghi gắn tag sẽ không bị xóa.`)) return;
          const result = await deleteTagOption(tag.id);
          if (result.ok) onRefresh();
          else toast.error(result.error);
        }}
      >
        ×
      </button>
    </div>
  );
}

function SystemStatusManager({
  databaseKey,
  property,
  onRefresh,
}: {
  databaseKey: DatabaseKey;
  property: DatabaseProperty;
  onRefresh: () => void;
}) {
  const [items, setItems] = useState<StatusMeta[]>(() => getSystemStatusOptions(databaseKey, property));
  const [saving, setSaving] = useState(false);

  async function saveAll() {
    setSaving(true);
    const result = await saveDatabaseProperty({
      id: property.id,
      databaseKey,
      name: property.property_name,
      type: property.property_type,
      visible: property.is_visible,
      position: property.position,
      configuration: {
        ...property.configuration,
        status_options: Object.fromEntries(items.map(s => [s.value, { label: s.label, color: s.color, group: s.group }])),
      },
    });
    setSaving(false);
    if (result.ok) {
      toast.success('Đã lưu cấu hình trạng thái');
      onRefresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="rounded-xl border border-line p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold">{property.property_name} (Hệ thống)</p>
        <button type="button" className="btn btn-primary !px-2 !py-0.5 text-xs" disabled={saving} onClick={() => void saveAll()}>
          Lưu
        </button>
      </div>
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={item.value} className="grid grid-cols-[24px_1fr_98px] items-center gap-1">
            <input
              type="color"
              aria-label={`Màu trạng thái ${item.value}`}
              value={item.color}
              onChange={e => setItems(curr => curr.map((s, i) => (i === idx ? { ...s, color: e.target.value } : s)))}
              className="h-6 w-6 cursor-pointer rounded border border-line"
            />
            <input
              className="input !px-1.5 !py-1 text-xs"
              aria-label={`Nhãn trạng thái ${item.value}`}
              value={item.label}
              onChange={e => setItems(curr => curr.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s)))}
            />
            <SelectDropdown
              size="xs"
              aria-label={`Nhóm trạng thái ${item.value}`}
              value={item.group}
              onChange={val =>
                setItems(curr => curr.map((s, i) => (i === idx ? { ...s, group: val as StatusGroup } : s)))
              }
              options={STATUS_GROUP_ORDER.map(g => ({ value: g, label: STATUS_GROUP_LABELS[g].split(' ')[0] }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function OptionManager({
  databaseKey,
  properties,
  options,
  onRefresh,
}: {
  databaseKey: DatabaseKey;
  properties: DatabaseProperty[];
  options: PropertyOption[];
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const customChoiceProps = properties.filter(
    p => !p.is_system_property && ['select', 'multi_select', 'status'].includes(p.property_type)
  );
  const systemStatusProps = properties.filter(p => p.is_system_property && p.property_type === 'status');
  if (!customChoiceProps.length && !systemStatusProps.length) return null;

  return (
    <div>
      <button type="button" className="text-xs text-muted underline hover:text-ink" onClick={() => setOpen(!open)}>
        {open ? 'Ẩn quản lý trạng thái & lựa chọn' : 'Quản lý trạng thái & lựa chọn'}
      </button>
      {open && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {systemStatusProps.map(p => (
            <SystemStatusManager key={p.id} databaseKey={databaseKey} property={p} onRefresh={onRefresh} />
          ))}
          {customChoiceProps.map(p => (
            <CustomOptionCard key={p.id} property={p} options={options.filter(o => o.property_id === p.id)} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomOptionCard({
  property,
  options,
  onRefresh,
}: {
  property: DatabaseProperty;
  options: PropertyOption[];
  onRefresh: () => void;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#2563EB');
  const [newGroup, setNewGroup] = useState<StatusGroup>('todo');

  return (
    <div className="rounded-xl border border-line p-2.5">
      <p className="mb-2 text-xs font-semibold">{property.property_name}</p>
      {options.map(o => (
        <OptionEditor key={o.id} option={o} isStatus={property.property_type === 'status'} onRefresh={onRefresh} />
      ))}
      <form
        className="mt-2 flex items-center gap-1 border-t border-line pt-2"
        onSubmit={async e => {
          e.preventDefault();
          if (!newLabel.trim()) return;
          const res = await savePropertyOption({
            propertyId: property.id,
            label: newLabel,
            color: newColor,
            position: options.length,
            statusGroup: newGroup,
          });
          if (res.ok) {
            setNewLabel('');
            onRefresh();
          } else toast.error(res.error);
        }}
      >
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="h-6 w-6 rounded border border-line" />
        <input className="input !py-1 text-xs" placeholder="Thêm lựa chọn..." value={newLabel} onChange={e => setNewLabel(e.target.value)} />
        {property.property_type === 'status' && (
          <SelectDropdown
            size="xs"
            className="!w-24 shrink-0"
            aria-label="Nhóm lựa chọn mới"
            value={newGroup}
            onChange={val => setNewGroup(val as StatusGroup)}
            options={[
              { value: 'todo', label: 'To-do' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'complete', label: 'Complete' },
            ]}
          />
        )}
        <button className="btn !px-2 !py-1 text-xs">+</button>
      </form>
    </div>
  );
}

function OptionEditor({
  option,
  isStatus,
  onRefresh,
}: {
  option: PropertyOption;
  isStatus: boolean;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(option.label);
  const [color, setColor] = useState(option.color);
  const [group, setGroup] = useState<StatusGroup>(option.status_group ?? 'todo');
  return (
    <div className="mb-1 flex items-center gap-1">
      <input aria-label="Màu lựa chọn" type="color" value={color} onChange={event => setColor(event.target.value)} />
      <input className="input !py-1 text-xs" value={name} onChange={event => setName(event.target.value)} />
      {isStatus && (
        <SelectDropdown
          size="xs"
          className="!w-24 shrink-0"
          aria-label="Nhóm trạng thái lựa chọn"
          value={group}
          onChange={val => setGroup(val as StatusGroup)}
          options={[
            { value: 'todo', label: 'To-do' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'complete', label: 'Complete' },
          ]}
        />
      )}
      <button
        type="button"
        className="text-xs underline"
        onClick={async () => {
          const result = await savePropertyOption({
            id: option.id,
            propertyId: option.property_id,
            label: name,
            color,
            position: option.position,
            statusGroup: group,
          });
          if (result.ok) {
            onRefresh();
            toast.success('Đã lưu lựa chọn');
          } else toast.error(result.error);
        }}
      >
        Lưu
      </button>
      <button
        type="button"
        className="text-xs text-red-600"
        onClick={async () => {
          if (!window.confirm(`Xóa lựa chọn ${option.label}?`)) return;
          const result = await deletePropertyOption(option.property_id, option.id);
          if (result.ok) onRefresh();
          else toast.error(result.error);
        }}
      >
        ×
      </button>
    </div>
  );
}

export function BulkActionToolbar({
  databaseKey,
  count,
  properties,
  options,
  lookups,
  onEdit,
  onDuplicate,
  onDelete,
  onClear,
}: {
  databaseKey: DatabaseKey;
  count: number;
  properties: DatabaseProperty[];
  options: PropertyOption[];
  lookups: Record<string, Record<string, string>>;
  onEdit: (key: string, value: unknown) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
  onClear: () => void;
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  if (!count) return null;

  const selectedProp = properties.find(p => p.property_key === key);

  function renderBulkInput() {
    if (!selectedProp) {
      return <input className="input !w-36 !py-1 text-xs" disabled placeholder="Giá trị" value={value} />;
    }
    if (selectedProp.property_type === 'checkbox') {
      return (
        <SelectDropdown
          size="sm"
          className="!w-36"
          aria-label="Giá trị hàng loạt"
          value={value}
          onChange={setValue}
          options={[
            { value: '', label: 'Chọn' },
            { value: 'true', label: 'Đã chọn' },
            { value: 'false', label: 'Chưa chọn' },
          ]}
        />
      );
    }
    if (selectedProp.property_type === 'relation') {
      const entries = Object.entries(lookups[String(selectedProp.configuration.target ?? '')] ?? {});
      return (
        <SelectDropdown
          size="sm"
          className="!w-44"
          aria-label="Giá trị hàng loạt"
          value={value}
          onChange={setValue}
          options={[{ value: '', label: '— Trống —' }, ...entries.map(([id, name]) => ({ value: id, label: name }))]}
        />
      );
    }
    if (selectedProp.property_type === 'status' || selectedProp.property_type === 'select') {
      const choices =
        selectedProp.is_system_property && selectedProp.property_type === 'status'
          ? getSystemStatusOptions(databaseKey, selectedProp).map(s => ({ value: s.value, label: s.label }))
          : selectedProp.is_system_property && selectedProp.property_key in SYSTEM_SELECT_CHOICES
            ? SYSTEM_SELECT_CHOICES[selectedProp.property_key].map(s => ({ value: s.value, label: s.label }))
            : options.filter(o => o.property_id === selectedProp.id).map(o => ({ value: o.id, label: o.label }));
      return (
        <SelectDropdown
          size="sm"
          className="!w-44"
          aria-label="Giá trị hàng loạt"
          value={value}
          onChange={setValue}
          options={[{ value: '', label: 'Chọn giá trị' }, ...choices]}
        />
      );
    }
    if (selectedProp.property_type === 'currency') {
      return (
        <MoneyInput
          showCurrencySuffix={false}
          allowNegative={selectedProp.property_key === 'opening_balance' || !selectedProp.is_system_property}
          className="!w-40 !py-1 text-xs"
          aria-label="Giá trị hàng loạt"
          placeholder="100,000"
          value={value}
          onValueChange={setValue}
        />
      );
    }
    const type =
      selectedProp.property_type === 'date'
        ? 'date'
        : selectedProp.property_type === 'number'
          ? 'number'
          : 'text';
    return (
      <input
        className="input !w-40 !py-1 text-xs"
        type={type}
        placeholder="Giá trị"
        value={value}
        onChange={event => setValue(event.target.value)}
      />
    );
  }

  return (
    <div className="sticky bottom-4 z-20 mx-auto mt-3 flex w-fit flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-xl">
      <strong className="text-sm">{count} đã chọn</strong>
      <SelectDropdown
        size="sm"
        className="!w-40"
        aria-label="Thuộc tính sửa hàng loạt"
        value={key}
        onChange={val => {
          setKey(val);
          setValue('');
        }}
        options={[
          { value: '', label: 'Thuộc tính' },
          ...properties.map(p => ({ value: p.property_key, label: p.property_name })),
        ]}
      />
      {renderBulkInput()}
      <button
        type="button"
        className="btn !py-1 text-xs"
        disabled={!key}
        onClick={() => {
          const parsed = selectedProp?.property_type === 'checkbox' ? value === 'true' : value;
          void onEdit(key, parsed);
        }}
      >
        Sửa hàng loạt
      </button>
      <button type="button" className="btn !py-1 text-xs" onClick={() => void onDuplicate()}>
        Nhân bản
      </button>
      <button type="button" className="btn btn-danger !py-1 text-xs" onClick={() => void onDelete()}>
        Xóa
      </button>
      <button type="button" className="text-xs text-muted hover:text-ink" onClick={onClear}>
        Bỏ chọn
      </button>
    </div>
  );
}
