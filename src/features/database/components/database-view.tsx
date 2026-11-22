'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/primitives';
import { SelectDropdown } from '@/components/ui/dropdown';
import { label } from '@/components/shared/format';
import { databaseConfig, mutableFields } from '../config';
import { evaluateFormula } from '../formula';
import {
  applyRules,
  filterSchema,
  propertyValue,
  sortsSchema,
  type DataRow,
  type FilterSet,
  type SortRule,
} from '../rules';
import {
  SYSTEM_SELECT_CHOICES,
  getSystemStatusOptions,
  resolveStatusOrSelectDisplay,
  rowTitle,
} from '../status';
import {
  bulkUpdateDatabaseRows,
  deleteDatabaseRows,
  deleteDatabaseView,
  duplicateDatabaseRow,
  saveDatabaseCell,
  saveDatabaseProperty,
  saveDatabaseView,
  setRecordTag,
} from '../actions';
import { BulkActionToolbar, DatabaseToolbar, type ViewPatch } from './database-controls';
import {
  ColoredChip,
  DatabaseTable,
  PropertyEditor,
  formatPropertyCell,
  formatPropertyText,
  typeLabels,
} from './database-table';
import type { DatabasePayload } from '../queries';
import type { DatabaseKey, DatabaseProperty, PropertyOption, PropertyType, TagOption, Json } from '@/types/database';

const emptyFilters: FilterSet = { logic: 'and', rules: [] };
const emptySorts: SortRule[] = [];

function recomputeFormulas(row: DataRow, properties: DatabaseProperty[]): DataRow {
  const formulas = properties.filter(p => !p.is_system_property && p.property_type === 'formula');
  if (!formulas.length) return row;
  const custom = { ...((row.custom_properties as Record<string, unknown>) ?? {}) };
  for (const prop of formulas) {
    const expr = typeof prop.configuration.expression === 'string' ? prop.configuration.expression : '';
    if (expr) custom[prop.property_key] = evaluateFormula(expr, row);
  }
  return { ...row, custom_properties: custom };
}

export function DatabaseView({
  data,
  initialViewId,
  embedded = false,
}: {
  data: DatabasePayload;
  initialViewId?: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [prevData, setPrevData] = useState(data);
  const [rows, setRows] = useState<DataRow[]>(data.rows as DataRow[]);
  const [views, setViews] = useState(data.views);
  const [properties, setProperties] = useState(data.properties);
  const [tags, setTags] = useState<TagOption[]>(data.tags);
  const [options, setOptions] = useState<PropertyOption[]>(data.options);
  const [viewId, setViewId] = useState(
    initialViewId && data.views.some(v => v.id === initialViewId) ? initialViewId : data.views[0]?.id ?? ''
  );
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PropertyType>('text');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const lastSelected = useRef<string | null>(null);
  const viewsRef = useRef(views);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    viewsRef.current = views;
  }, [views]);

  // React-recommended prop sync without calling setState inside useEffect
  if (prevData !== data) {
    setPrevData(data);
    setRows(data.rows as DataRow[]);
    setViews(data.views);
    setProperties(data.properties);
    setTags(data.tags);
    setOptions(data.options);
    if (!data.views.some(v => v.id === viewId)) {
      setViewId(data.views[0]?.id ?? '');
    }
  }

  const view = views.find(v => v.id === viewId) ?? views[0];
  const key = data.key;
  const refresh = useCallback(() => router.refresh(), [router]);

  const filters = useMemo(() => {
    const parsed = filterSchema.safeParse(view?.filters);
    return parsed.success ? parsed.data : emptyFilters;
  }, [view?.filters]);

  const sorts = useMemo(() => {
    const parsed = sortsSchema.safeParse(view?.sorts);
    return parsed.success ? parsed.data : emptySorts;
  }, [view?.sorts]);

  const visibleKeys = useMemo(
    () =>
      view && Array.isArray(view.visible_properties) && view.visible_properties.length
        ? (view.visible_properties as string[])
        : properties.filter(p => p.is_visible).map(p => p.property_key),
    [view, properties]
  );

  const columnOrder = useMemo(
    () => (view && Array.isArray(view.column_order) ? (view.column_order as string[]) : []),
    [view]
  );

  const visible = useMemo(
    () =>
      properties
        .filter(p => visibleKeys.includes(p.property_key))
        .sort((a, b) => {
          const ai = columnOrder.indexOf(a.property_key);
          const bi = columnOrder.indexOf(b.property_key);
          return ai < 0 && bi < 0 ? a.position - b.position : ai < 0 ? 1 : bi < 0 ? -1 : ai - bi;
        }),
    [properties, visibleKeys, columnOrder]
  );

  const widths = useMemo(
    () =>
      view && view.column_widths && typeof view.column_widths === 'object' && !Array.isArray(view.column_widths)
        ? (view.column_widths as Record<string, number>)
        : {},
    [view]
  );

  const configuration = useMemo(
    () =>
      view && view.configuration && typeof view.configuration === 'object' && !Array.isArray(view.configuration)
        ? (view.configuration as Record<string, unknown>)
        : {},
    [view]
  );

  const resolveDisplay = useCallback(
    (row: DataRow, propKey: string) => {
      const prop = properties.find(p => p.property_key === propKey);
      if (!prop) return '';
      return formatPropertyText(key, row, prop, data.lookups, options, tags);
    },
    [properties, key, data.lookups, options, tags]
  );

  const ordered = useMemo(() => {
    const list = Array.isArray(configuration.row_order) ? (configuration.row_order as string[]) : [];
    return [...rows].sort((a, b) => {
      const ai = list.indexOf(a.id);
      const bi = list.indexOf(b.id);
      return ai < 0 && bi < 0 ? 0 : ai < 0 ? 1 : bi < 0 ? -1 : ai - bi;
    });
  }, [rows, configuration.row_order]);

  const filtered = useMemo(() => {
    let list = ordered;
    if (monthFilter && data.config.dateKey) {
      const dk = data.config.dateKey;
      list = list.filter(row => String(propertyValue(row, dk) ?? '').startsWith(monthFilter));
    }
    if (search.trim()) {
      const term = search.trim().toLocaleLowerCase('vi');
      list = list.filter(row =>
        visible.some(p => {
          const raw = String(propertyValue(row, p.property_key) ?? '').toLocaleLowerCase('vi');
          const text = formatPropertyText(key, row, p, data.lookups, options, tags).toLocaleLowerCase('vi');
          return raw.includes(term) || text.includes(term);
        })
      );
    }
    return applyRules(list, filters, sorts, resolveDisplay);
  }, [ordered, monthFilter, data.config.dateKey, search, visible, key, data.lookups, options, tags, filters, sorts, resolveDisplay]);

  const pageSize = 30;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const pageRows = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  async function saveView(patch: ViewPatch) {
    const latestViews = viewsRef.current.length ? viewsRef.current : views;
    const currentView = latestViews.find(v => v.id === viewId) ?? view;
    if (!currentView) return false;

    const currFiltersParsed = filterSchema.safeParse(currentView.filters);
    const currFilters = currFiltersParsed.success ? currFiltersParsed.data : emptyFilters;
    const currSortsParsed = sortsSchema.safeParse(currentView.sorts);
    const currSorts = currSortsParsed.success ? currSortsParsed.data : emptySorts;
    const currVisible =
      Array.isArray(currentView.visible_properties) && currentView.visible_properties.length
        ? (currentView.visible_properties as string[])
        : properties.filter(p => p.is_visible).map(p => p.property_key);
    const currWidths =
      currentView.column_widths && typeof currentView.column_widths === 'object' && !Array.isArray(currentView.column_widths)
        ? (currentView.column_widths as Record<string, number>)
        : {};
    const currOrder = Array.isArray(currentView.column_order) ? (currentView.column_order as string[]) : [];
    const currConfig =
      currentView.configuration && typeof currentView.configuration === 'object' && !Array.isArray(currentView.configuration)
        ? (currentView.configuration as Record<string, unknown>)
        : {};

    const validKeys = new Set(properties.map(p => p.property_key));
    const input = {
      id: currentView.id,
      databaseKey: key,
      viewName: patch.view_name ?? currentView.view_name,
      viewType: currentView.view_type,
      filters: patch.filters ?? currFilters,
      sorts: patch.sorts ?? currSorts,
      groupBy: patch.group_by === undefined ? currentView.group_by : patch.group_by,
      visibleProperties: (patch.visible_properties ?? currVisible).filter(k => validKeys.has(k) || k.startsWith('custom_')),
      columnWidths: Object.fromEntries(Object.entries(patch.column_widths ?? currWidths).filter(([k]) => validKeys.has(k))),
      columnOrder: (patch.column_order ?? currOrder).filter(k => validKeys.has(k) || k.startsWith('custom_')),
      configuration: patch.configuration ?? currConfig,
    };

    const previousViews = latestViews;
    const optimisticViews = latestViews.map(item =>
      item.id === currentView.id
        ? {
          ...item,
          view_name: input.viewName,
          filters: input.filters,
          sorts: input.sorts,
          group_by: input.groupBy,
          visible_properties: input.visibleProperties,
          column_widths: input.columnWidths,
          column_order: input.columnOrder,
          configuration: input.configuration as Json,
        }
        : item
    );
    viewsRef.current = optimisticViews;
    setViews(optimisticViews);
    setSaveStatus('saving');

    const run = saveQueueRef.current.then(() => saveDatabaseView(input));
    saveQueueRef.current = run.catch(() => { });
    const result = await run;

    if (!result.ok) {
      viewsRef.current = previousViews;
      setViews(previousViews);
      setSaveStatus('error');
      toast.error(result.error);
      return false;
    }
    setSaveStatus('saved');
    toast.success('Đã lưu view');
    return true;
  }

  async function createView(name: string, type: 'table' | 'board' | 'calendar') {
    setSaveStatus('saving');
    const result = await saveDatabaseView({
      databaseKey: key,
      viewName: name,
      viewType: type,
      filters: emptyFilters,
      sorts: [],
      groupBy: type === 'board' ? data.config.groupKey ?? null : null,
      visibleProperties: visibleKeys,
      columnWidths: {},
      columnOrder: visibleKeys,
      configuration: {},
    });
    if (!result.ok) {
      setSaveStatus('error');
      toast.error(result.error);
      return;
    }
    setSaveStatus('saved');
    setViewId(result.value);
    if (!embedded) history.replaceState(null, '', `?view=${result.value}`);
    refresh();
  }

  async function deleteView() {
    if (!view) return;
    setSaveStatus('saving');
    const result = await deleteDatabaseView(key, view.id);
    if (!result.ok) {
      setSaveStatus('error');
      toast.error(result.error);
      return;
    }
    setSaveStatus('saved');
    const next = views.find(item => item.id !== view.id);
    const remaining = views.filter(item => item.id !== view.id);
    viewsRef.current = remaining;
    setViews(remaining);
    setViewId(next?.id ?? '');
    if (!embedded) history.replaceState(null, '', next ? `?view=${next.id}` : location.pathname);
  }

  async function addProperty(name: string, type: PropertyType, config: Record<string, unknown>) {
    setSaveStatus('saving');
    const position = insertAt ?? properties.length;
    const result = await saveDatabaseProperty({
      databaseKey: key,
      name,
      type,
      visible: true,
      position,
      configuration: config,
    });
    if (!result.ok) {
      setSaveStatus('error');
      toast.error(result.error);
      return;
    }
    // Also add newly created property to active view's visible_properties & column_order so it renders immediately
    const newKey = result.value.propertyKey;
    const latestView = (viewsRef.current.length ? viewsRef.current : views).find(v => v.id === viewId) ?? view;
    if (latestView && Array.isArray(latestView.visible_properties) && latestView.visible_properties.length) {
      const latestVisible = latestView.visible_properties as string[];
      const latestOrder = Array.isArray(latestView.column_order) ? (latestView.column_order as string[]) : [];
      const nextVisible = [...new Set([...latestVisible, newKey])];
      const nextOrder = [...(latestOrder.length ? latestOrder : latestVisible)];
      nextOrder.splice(Math.min(position, nextOrder.length), 0, newKey);
      await saveView({ visible_properties: nextVisible, column_order: nextOrder });
    }
    setSaveStatus('saved');
    setInsertAt(null);
    toast.success('Đã tạo thuộc tính');
    refresh();
  }

  async function hideProperty(propertyKey: string) {
    const nextVisible = visibleKeys.filter(k => k !== propertyKey);
    await saveView({ visible_properties: nextVisible });
  }

  const onChange = useCallback(
    async (id: string, propertyKey: string, value: unknown) => {
      setSaveStatus('saving');
      const result = await saveDatabaseCell({ databaseKey: key, recordId: id, propertyKey, value });
      if (!result.ok) {
        setSaveStatus('error');
        toast.error(result.error);
        return false;
      }
      setSaveStatus('saved');
      setRows(current =>
        current.map(row => {
          if (row.id !== id) return row;
          const updated: DataRow = propertyKey.startsWith('custom_')
            ? { ...row, custom_properties: { ...(row.custom_properties as Record<string, unknown>), [propertyKey]: result.value } }
            : { ...row, [propertyKey]: result.value };
          return recomputeFormulas(updated, properties);
        })
      );
      // If a finance-affecting or formula-affecting field changed, refresh server-computed totals in background
      if (['amount', 'opening_balance', 'status', 'category_id', 'account_id', 'project_id', 'transaction_date'].includes(propertyKey)) {
        refresh();
      }
      toast.success('Đã lưu');
      return true;
    },
    [key, properties, refresh]
  );

  const onTag = useCallback(
    async (id: string, tag: string, checked: boolean) => {
      setSaveStatus('saving');
      const result = await setRecordTag(key, id, tag, checked);
      if (!result.ok) {
        setSaveStatus('error');
        toast.error(result.error);
        return false;
      }
      setSaveStatus('saved');
      setRows(current =>
        current.map(row =>
          row.id === id
            ? {
              ...row,
              tags: checked
                ? [...new Set([...((row.tags as string[]) ?? []), tag])]
                : ((row.tags as string[]) ?? []).filter(item => item !== tag),
            }
            : row
        )
      );
      return true;
    },
    [key]
  );

  const onOptionCreated = useCallback((option: PropertyOption) => {
    setOptions(current => [...current, option]);
  }, []);

  const onTagCreated = useCallback((tag: TagOption) => {
    setTags(current => [...current, tag]);
  }, []);

  async function remove(ids: string[]) {
    if (!window.confirm(`Xóa ${ids.length} bản ghi? Thao tác sẽ hoàn tác toàn bộ nếu có bản ghi vi phạm ràng buộc Finance/Projects.`)) return;
    setSaveStatus('saving');
    const result = await deleteDatabaseRows(key, ids);
    if (!result.ok) {
      setSaveStatus('error');
      toast.error(result.error);
      return;
    }
    setSaveStatus('saved');
    setRows(current => current.filter(row => !ids.includes(row.id)));
    if (openRow && ids.includes(openRow)) setOpenRow(null);
    setSelected(new Set());
    toast.success(`Đã xóa ${ids.length} bản ghi`);
    refresh();
  }

  async function duplicate(ids: string[]) {
    setSaveStatus('saving');
    for (const id of ids) {
      const result = await duplicateDatabaseRow(key, id);
      if (!result.ok) {
        setSaveStatus('error');
        toast.error(result.error);
        return;
      }
    }
    setSaveStatus('saved');
    refresh();
    toast.success('Đã nhân bản');
  }

  async function bulkEdit(propertyKey: string, value: unknown) {
    const ids = [...selected];
    if (!ids.length) return;
    setSaveStatus('saving');
    const result = await bulkUpdateDatabaseRows({
      databaseKey: key,
      recordIds: ids,
      propertyKey,
      value,
    });
    if (!result.ok) {
      setSaveStatus('error');
      toast.error(result.error);
      return;
    }
    setSaveStatus('saved');
    setRows(current =>
      current.map(row => {
        if (!selected.has(row.id)) return row;
        const updated: DataRow = propertyKey.startsWith('custom_')
          ? { ...row, custom_properties: { ...(row.custom_properties as Record<string, unknown>), [propertyKey]: result.value } }
          : { ...row, [propertyKey]: result.value };
        return recomputeFormulas(updated, properties);
      })
    );
    setSelected(new Set());
    toast.success(`Đã cập nhật ${ids.length} bản ghi`);
    refresh();
  }

  function select(id: string, shift: boolean) {
    const next = new Set(selected);
    if (shift && lastSelected.current) {
      const ids = pageRows.map(row => row.id);
      const a = ids.indexOf(lastSelected.current);
      const b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        for (const rowId of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(rowId);
      }
    } else if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    lastSelected.current = id;
    setSelected(next);
  }

  function moveColumn(from: string, to: string) {
    if (!visibleKeys.includes(from) || !visibleKeys.includes(to) || from === to) return;
    const order = [...visible.map(p => p.property_key)];
    order.splice(order.indexOf(from), 1);
    order.splice(order.indexOf(to), 0, from);
    void saveView({ column_order: order });
  }

  function moveRow(from: string, to: string) {
    if (from === to) return;
    const order = filtered.map(row => row.id);
    const index = order.indexOf(from);
    const target = order.indexOf(to);
    if (index < 0 || target < 0) return;
    order.splice(index, 1);
    order.splice(target, 0, from);
    void saveView({ configuration: { ...configuration, row_order: order } });
  }

  const openFullPage = useCallback(
    (id: string) => {
      router.push(`/app/database/${key}/${id}`);
    },
    [router, key]
  );

  const bulkEditableProps = useMemo(
    () =>
      properties.filter(p => {
        if (['formula', 'created_time', 'last_edited_time', 'multi_select'].includes(p.property_type)) return false;
        if (p.property_key === 'tags') return false;
        return !p.is_system_property || mutableFields[key].includes(p.property_key);
      }),
    [properties, key]
  );

  const activeRow = openRow ? rows.find(row => row.id === openRow) ?? null : null;
  const effectiveGroupKey = view?.group_by ?? data.config.groupKey ?? '';

  if (!view) return <div className="card p-8">Không thể tải view. Làm mới trang để thử lại.</div>;

  return (
    <>
      {embedded ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            Chế độ bảng dữ liệu dùng chung (Table · Board · Calendar · Lọc · Sắp xếp · Nhóm · Tags).
          </p>
          <Link href={`/app/database/${key}`} className="inline-flex items-center gap-1 text-xs font-medium underline">
            Mở toàn trang <ExternalLink size={12} />
          </Link>
        </div>
      ) : (
        <PageHeader
          title={data.config.title}
          description="Bảng dữ liệu, board và lịch cùng dùng chung bản ghi thực tế."
          createHref={data.config.createHref}
          createLabel={data.config.createLabel}
        />
      )}
      <DatabaseToolbar
        databaseKey={key}
        view={view}
        views={views}
        properties={properties}
        options={options}
        tags={tags}
        lookups={data.lookups}
        search={search}
        monthFilter={monthFilter}
        saveStatus={saveStatus}
        onSearch={val => {
          setSearch(val);
          setPage(0);
        }}
        onMonthFilter={val => {
          setMonthFilter(val);
          setPage(0);
        }}
        onSave={saveView}
        onSelect={id => {
          setViewId(id);
          setPage(0);
          setSelected(new Set());
          if (!embedded) history.replaceState(null, '', `?view=${id}`);
        }}
        onCreate={createView}
        onDeleteView={deleteView}
        onAddProperty={addProperty}
        onRefresh={refresh}
      />
      {insertAt !== null && (
        <form
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2"
          onSubmit={event => {
            event.preventDefault();
            void addProperty(newName, newType, newType === 'relation' ? { target: 'projects' } : {});
            setNewName('');
          }}
        >
          <span className="text-xs">Thêm cột tại vị trí {insertAt + 1}</span>
          <input
            className="input !w-44 !py-1"
            required
            placeholder="Tên thuộc tính"
            value={newName}
            onChange={event => setNewName(event.target.value)}
          />
          <SelectDropdown
            size="sm"
            className="!w-40"
            aria-label="Kiểu thuộc tính chèn"
            value={newType}
            onChange={val => setNewType(val as PropertyType)}
            options={Object.entries(typeLabels)
              .filter(([type]) => !['created_time', 'last_edited_time', 'formula'].includes(type))
              .map(([type, name]) => ({ value: type, label: name }))}
          />
          <button className="btn btn-primary !py-1 text-xs">Tạo</button>
          <button type="button" className="text-xs text-muted" onClick={() => setInsertAt(null)}>
            Hủy
          </button>
        </form>
      )}
      <p className="meta mb-2">{filtered.length} bản ghi</p>
      {view.view_type === 'table' ? (
        <>
          <DatabaseTable
            databaseKey={key}
            rows={pageRows}
            properties={visible}
            allProperties={properties}
            options={options}
            tags={tags}
            lookups={data.lookups}
            widths={widths}
            wrap={Boolean(configuration.wrap)}
            selected={selected}
            onSelect={select}
            onSelectAll={checked => setSelected(checked ? new Set(pageRows.map(row => row.id)) : new Set())}
            onChange={onChange}
            onTag={onTag}
            onOptionCreated={onOptionCreated}
            onTagCreated={onTagCreated}
            onOpen={setOpenRow}
            onOpenFullPage={openFullPage}
            onDuplicate={id => void duplicate([id])}
            onDelete={id => void remove([id])}
            onMoveColumn={moveColumn}
            onResize={(property, width) => void saveView({ column_widths: { ...widths, [property]: width } })}
            onMoveRow={moveRow}
            onRefresh={refresh}
            onHideProperty={propertyKey => void hideProperty(propertyKey)}
            onInsert={setInsertAt}
            groupBy={view.group_by}
          />
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted">
            <span>
              Trang {safePage + 1}/{pages}
            </span>
            <button
              type="button"
              className="btn !p-1"
              aria-label="Trang trước"
              disabled={safePage <= 0}
              onClick={() => setPage(Math.max(0, safePage - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="btn !p-1"
              aria-label="Trang sau"
              disabled={safePage >= pages - 1}
              onClick={() => setPage(Math.min(pages - 1, safePage + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      ) : view.view_type === 'board' ? (
        <DatabaseBoard
          databaseKey={key}
          rows={filtered}
          keyName={effectiveGroupKey}
          properties={visible}
          allProperties={properties}
          options={options}
          tags={tags}
          lookups={data.lookups}
          onOpen={setOpenRow}
          onDrop={async (id, value) => {
            if (!effectiveGroupKey) return;
            const groupProp = properties.find(p => p.property_key === effectiveGroupKey);
            if (!groupProp) return;
            const canDrop = !groupProp.is_system_property || mutableFields[key].includes(effectiveGroupKey);
            if (canDrop) await onChange(id, effectiveGroupKey, value === '__empty__' ? '' : value);
          }}
        />
      ) : (
        <DatabaseCalendar
          databaseKey={key}
          rows={filtered}
          dateKey={data.config.dateKey ?? ''}
          properties={properties}
          options={options}
          lookups={data.lookups}
          onOpen={setOpenRow}
        />
      )}
      <BulkActionToolbar
        databaseKey={key}
        count={selected.size}
        properties={bulkEditableProps}
        options={options}
        lookups={data.lookups}
        onEdit={bulkEdit}
        onDuplicate={() => duplicate([...selected])}
        onDelete={() => remove([...selected])}
        onClear={() => setSelected(new Set())}
      />
      {activeRow && (
        <RowDetailDrawer
          databaseKey={key}
          row={activeRow}
          properties={properties}
          options={options}
          tags={tags}
          lookups={data.lookups}
          onChange={onChange}
          onTag={onTag}
          onOptionCreated={onOptionCreated}
          onTagCreated={onTagCreated}
          onClose={() => setOpenRow(null)}
        />
      )}
    </>
  );
}

export function DatabaseBoard({
  databaseKey,
  rows,
  keyName,
  properties,
  allProperties,
  options,
  tags,
  lookups,
  onOpen,
  onDrop,
}: {
  databaseKey: DatabaseKey;
  rows: DataRow[];
  keyName: string;
  properties: DatabaseProperty[];
  allProperties: DatabaseProperty[];
  options: PropertyOption[];
  tags: TagOption[];
  lookups: Record<string, Record<string, string>>;
  onOpen: (id: string) => void;
  onDrop: (id: string, value: string) => Promise<void>;
}) {
  const groupProp = allProperties.find(p => p.property_key === keyName);
  const titleKey = databaseConfig[databaseKey].titleKey;

  const columns = useMemo(() => {
    const map = new Map<string, { label: string; color?: string; items: DataRow[] }>();
    // Pre-populate known status/select columns so empty columns are droppable
    if (groupProp?.is_system_property && groupProp.property_type === 'status') {
      for (const s of getSystemStatusOptions(databaseKey, groupProp)) {
        map.set(s.value, { label: s.label, color: s.color, items: [] });
      }
    } else if (groupProp?.is_system_property && groupProp.property_key in SYSTEM_SELECT_CHOICES) {
      for (const s of SYSTEM_SELECT_CHOICES[groupProp.property_key]) {
        map.set(s.value, { label: s.label, color: s.color, items: [] });
      }
    } else if (groupProp && !groupProp.is_system_property && ['select', 'status'].includes(groupProp.property_type)) {
      for (const o of options.filter(opt => opt.property_id === groupProp.id)) {
        map.set(o.id, { label: o.label, color: o.color, items: [] });
      }
    }

    for (const row of rows) {
      const raw = propertyValue(row, keyName);
      const bucketKey = raw == null || raw === '' ? '__empty__' : String(raw);
      if (!map.has(bucketKey)) {
        let colLabel = 'Chưa có';
        let colColor: string | undefined;
        if (bucketKey !== '__empty__') {
          if (groupProp?.property_type === 'relation') {
            colLabel = lookups[String(groupProp.configuration.target ?? '')]?.[bucketKey] ?? bucketKey;
          } else if (groupProp) {
            const resolved = resolveStatusOrSelectDisplay(databaseKey, groupProp, bucketKey, options);
            colLabel = resolved.label;
            colColor = resolved.color;
          } else {
            colLabel = label(bucketKey);
          }
        }
        map.set(bucketKey, { label: colLabel, color: colColor, items: [] });
      }
      map.get(bucketKey)!.items.push(row);
    }
    return [...map.entries()];
  }, [rows, keyName, groupProp, databaseKey, options, lookups]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map(([bucketKey, col]) => (
        <section
          key={bucketKey}
          className="w-68 shrink-0 rounded-lg border border-line bg-soft/50 p-2"
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            const id = event.dataTransfer.getData('application/x-row');
            if (id) void onDrop(id, bucketKey);
          }}
        >
          <h2 className="flex items-center justify-between px-2 py-2 text-sm font-semibold">
            <ColoredChip value={col.label} color={col.color} />
            <span className="text-xs text-muted">{col.items.length}</span>
          </h2>
          <div className="space-y-2">
            {col.items.map(row => (
              <button
                key={row.id}
                type="button"
                draggable
                onDragStart={event => event.dataTransfer.setData('application/x-row', row.id)}
                className="block w-full rounded-lg border border-line bg-surface p-3 text-left shadow-sm hover:bg-soft"
                onClick={() => onOpen(row.id)}
              >
                <strong className="block text-sm">{rowTitle(row, databaseKey, lookups)}</strong>
                <div className="mt-2 space-y-1">
                  {properties
                    .filter(p => p.property_key !== titleKey && p.property_key !== keyName)
                    .slice(0, 4)
                    .map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span className="shrink-0">{p.property_name}:</span>
                        <span className="truncate">
                          {formatPropertyCell(databaseKey, row, p, lookups, options, tags)}
                        </span>
                      </div>
                    ))}
                </div>
              </button>
            ))}
            {col.items.length === 0 && (
              <p className="rounded border border-dashed border-line px-2 py-4 text-center text-xs text-muted">
                Kéo thẻ vào đây
              </p>
            )}
          </div>
        </section>
      ))}
      {columns.length === 0 && (
        <div className="rounded-lg border border-line p-8 text-muted">Không có bản ghi phù hợp.</div>
      )}
    </div>
  );
}

export function DatabaseCalendar({
  databaseKey,
  rows,
  dateKey,
  properties,
  options,
  lookups,
  onOpen,
}: {
  databaseKey: DatabaseKey;
  rows: DataRow[];
  dateKey: string;
  properties: DatabaseProperty[];
  options: PropertyOption[];
  lookups: Record<string, Record<string, string>>;
  onOpen: (id: string) => void;
}) {
  const dateProperties = properties.filter(p => p.property_type === 'date');
  const [activeDateKey, setActiveDateKey] = useState(dateKey || dateProperties[0]?.property_key || '');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [year, monthNum] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNum - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const slots = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => index - offset + 1);
  const move = (delta: number) => setMonth(new Date(Date.UTC(year, monthNum - 1 + delta, 1)).toISOString().slice(0, 7));
  const statusProp = properties.find(p => p.property_type === 'status');

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" className="btn !p-1" aria-label="Tháng trước" onClick={() => move(-1)}>
            <ChevronLeft size={16} />
          </button>
          <h2 className="font-semibold">
            Tháng {monthNum}/{year}
          </h2>
          <button type="button" className="btn !p-1" aria-label="Tháng sau" onClick={() => move(1)}>
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="btn !px-2 !py-1 text-xs"
            onClick={() => setMonth(new Date().toISOString().slice(0, 7))}
          >
            Hôm nay
          </button>
        </div>
        {dateProperties.length > 1 && (
          <SelectDropdown
            size="sm"
            className="!w-40"
            aria-label="Cột ngày hiển thị"
            value={activeDateKey}
            onChange={setActiveDateKey}
            options={dateProperties.map(p => ({ value: p.property_key, label: p.property_name }))}
          />
        )}
      </div>
      <div className="grid min-w-[700px] grid-cols-7">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
          <div className="border-b border-r border-line bg-soft p-2 text-center text-xs font-semibold" key={day}>
            {day}
          </div>
        ))}
        {slots.map((day, index) => {
          const date = `${month}-${String(day).padStart(2, '0')}`;
          return (
            <div key={index} className="min-h-28 border-b border-r border-line p-1.5 text-xs">
              {day > 0 && day <= days && (
                <>
                  <span className="text-muted">{day}</span>
                  {rows
                    .filter(row => String(propertyValue(row, activeDateKey) ?? '').slice(0, 10) === date)
                    .map(row => {
                      const statusRaw = statusProp ? propertyValue(row, statusProp.property_key) : null;
                      const dotColor =
                        statusProp && statusRaw
                          ? resolveStatusOrSelectDisplay(databaseKey, statusProp, String(statusRaw), options).color
                          : undefined;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          className="mt-1 flex w-full items-center gap-1.5 truncate rounded bg-soft px-1.5 py-1 text-left hover:bg-stone-200 dark:hover:bg-stone-700"
                          onClick={() => onOpen(row.id)}
                        >
                          {dotColor && <span className="size-2 shrink-0 rounded-full" style={{ background: dotColor }} />}
                          <span className="truncate">{rowTitle(row, databaseKey, lookups)}</span>
                        </button>
                      );
                    })}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RowDetailDrawer({
  databaseKey,
  row,
  properties,
  options,
  tags,
  lookups,
  onChange,
  onTag,
  onOptionCreated,
  onTagCreated,
  onClose,
}: {
  databaseKey: DatabaseKey;
  row: DataRow;
  properties: DatabaseProperty[];
  options: PropertyOption[];
  tags: TagOption[];
  lookups: Record<string, Record<string, string>>;
  onChange: (id: string, key: string, value: unknown) => Promise<boolean>;
  onTag: (id: string, tag: string, selected: boolean) => Promise<boolean>;
  onOptionCreated?: (option: PropertyOption) => void;
  onTagCreated?: (tag: TagOption) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
      onKeyDown={e => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <aside
        className="h-full w-full max-w-xl overflow-auto border-l border-line bg-surface p-5 shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="meta">{databaseConfig[databaseKey].title}</p>
            <h2 className="mt-1 text-2xl font-semibold">{rowTitle(row, databaseKey, lookups)}</h2>
          </div>
          <button type="button" className="btn !p-1" aria-label="Đóng" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="divide-y divide-line">
          {properties.map(property => (
            <div key={property.id} className="grid grid-cols-[140px_1fr] items-center gap-3 py-2 text-sm">
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
                    onOptionCreated={onOptionCreated}
                    onTagCreated={onTagCreated}
                    onClose={() => setEditing(null)}
                  />
                ) : (
                  <button
                    type="button"
                    className="w-full rounded px-1 py-0.5 text-left hover:bg-soft"
                    onClick={() => setEditing(property.id)}
                  >
                    {formatPropertyCell(databaseKey, row, property, lookups, options, tags)}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3 border-t border-line pt-4">
          <Link className="btn btn-primary text-xs" href={`/app/database/${databaseKey}/${row.id}`}>
            <ExternalLink size={14} /> Mở thành trang chi tiết
          </Link>
        </div>
      </aside>
    </div>
  );
}
