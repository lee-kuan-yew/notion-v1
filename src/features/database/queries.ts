import 'server-only';
import { requireOwner } from '@/lib/auth/owner';
import { loadDatabaseWorkspace } from '@/features/workspace/queries';
import { databaseConfig, tagTable } from './config';
import { evaluateFormula } from './formula';
import type { DataRow } from './rules';
import type { DatabaseKey, DatabaseProperty, DatabaseView, PropertyOption, TagOption, TagLink, Json } from '@/types/database';

export async function loadDatabase(key: DatabaseKey, scope?: { projectId?: string }) {
  const { supabase, user } = await requireOwner();
  const config = databaseConfig[key];
  const [workspace, initialPropsResult, initialViewsResult, optionsResult, tagsResult, linksResult] = await Promise.all([
    loadDatabaseWorkspace(),
    supabase.from('database_properties').select('*').eq('database_key', key).order('position'),
    supabase.from('database_views').select('*').eq('database_key', key).order('created_at'),
    supabase.from('database_property_options').select('*').order('position'),
    supabase.from('tag_options').select('*').order('name'),
    supabase.from(tagTable[key]).select('*'),
  ]);
  for (const [label, result] of [
    ['properties', initialPropsResult],
    ['views', initialViewsResult],
    ['options', optionsResult],
    ['tags', tagsResult],
    ['links', linksResult],
  ] as const) {
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
  }
  let properties = initialPropsResult.data as DatabaseProperty[];
  if (!properties.length) {
    const now = new Date().toISOString();
    const seededProps = config.properties.map((property, position) => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      database_key: key,
      ...property,
      configuration: property.configuration ?? {},
      position,
      is_system_property: true,
      is_visible: !['created_time', 'last_edited_time'].includes(property.property_type) && position < 9,
      created_at: now,
      updated_at: now,
    }));
    const insertProps = await supabase.from('database_properties').insert(seededProps);
    if (insertProps.error) throw new Error(insertProps.error.message);
    properties = seededProps as unknown as DatabaseProperty[];
  }
  let views = initialViewsResult.data as DatabaseView[];
  if (!views.length) {
    const now = new Date().toISOString();
    const types: ('table' | 'board' | 'calendar')[] = ['table'];
    if (config.groupKey) types.push('board');
    if (config.dateKey) types.push('calendar');
    const seededViews = types.map(view_type => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      database_key: key,
      view_name: { table: 'Bảng', board: 'Board', calendar: 'Lịch' }[view_type],
      view_type,
      filters: { logic: 'and', rules: [] },
      sorts: [],
      group_by: view_type === 'board' ? config.groupKey ?? null : null,
      visible_properties: [],
      column_widths: {},
      column_order: [],
      configuration: {},
      created_at: now,
      updated_at: now,
    }));
    const insertViews = await supabase.from('database_views').insert(seededViews);
    if (insertViews.error) throw new Error(insertViews.error.message);
    views = seededViews as unknown as DatabaseView[];
  }
  const propertyIds = new Set(properties.map(p => p.id));
  const options = (optionsResult.data as PropertyOption[]).filter(option => propertyIds.has(option.property_id));
  const tags = tagsResult.data as TagOption[];
  const links = linksResult.data as TagLink[];
  const tagsByRecord = new Map<string, string[]>();
  for (const link of links) tagsByRecord.set(link.record_id, [...(tagsByRecord.get(link.record_id) ?? []), link.tag_id]);

  let source = workspace[key] as unknown as Record<string, unknown>[];
  if (scope?.projectId && (key === 'tasks' || key === 'milestones' || key === 'transactions')) {
    source = source.filter(record => record.project_id === scope.projectId);
  }

  const spending = new Map(workspace.spending.map(row => [row.project_id, Number(row.spent)]));
  const balances = new Map(workspace.balances.map(row => [row.account_id, Number(row.balance)]));
  const actuals = new Map(workspace.actuals.map(row => [row.budget_id, Number(row.spent)]));
  const categoryParent = new Map(workspace.categories.map(row => [row.id, row.parent_id]));
  function categoryMatches(categoryId: string | null, target: string) {
    let id = categoryId;
    for (let depth = 0; id && depth < 20; depth++) {
      if (id === target) return true;
      id = categoryParent.get(id) ?? null;
    }
    return false;
  }

  const customFormulaProps = properties.filter(p => !p.is_system_property && p.property_type === 'formula');
  const tasksByProject = new Map<string, { total: number; done: number }>();
  if (key === 'projects') {
    for (const task of workspace.tasks) {
      if (!task.project_id || task.status === 'cancelled') continue;
      const entry = tasksByProject.get(task.project_id) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (task.status === 'done') entry.done += 1;
      tasksByProject.set(task.project_id, entry);
    }
  }

  const rows = source.map(record => {
    const row = { ...record, tags: tagsByRecord.get(String(record.id)) ?? [] } as Record<string, unknown>;
    if (key === 'projects') {
      row.actual_spending = spending.get(String(record.id)) ?? 0;
      const stats = tasksByProject.get(String(record.id));
      row.progress = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
    }
    if (key === 'accounts') row.current_balance = balances.get(String(record.id)) ?? 0;
    if (key === 'budgets') {
      const month = String(record.month_start).slice(0, 7);
      row.actual_spending =
        month === workspace.month.slice(0, 7)
          ? actuals.get(String(record.id)) ?? 0
          : workspace.transactions
              .filter(tx => tx.type === 'expense' && tx.transaction_date.startsWith(month) && categoryMatches(tx.category_id, String(record.category_id)))
              .reduce((sum, tx) => sum + Number(tx.amount), 0);
    }
    if (customFormulaProps.length) {
      const computedCustom = { ...((row.custom_properties as Record<string, unknown>) ?? {}) };
      for (const prop of customFormulaProps) {
        const expr = typeof prop.configuration.expression === 'string' ? prop.configuration.expression : '';
        if (expr) computedCustom[prop.property_key] = evaluateFormula(expr, row as DataRow);
      }
      row.custom_properties = computedCustom;
    }
    return row;
  });

  const categoryNames = Object.fromEntries(workspace.categories.map(row => [row.id, row.name]));
  const lookups: Record<string, Record<string, string>> = {
    accounts: Object.fromEntries(workspace.accounts.map(row => [row.id, row.name])),
    categories: categoryNames,
    projects: Object.fromEntries(workspace.projects.map(row => [row.id, row.name])),
    transactions: Object.fromEntries(workspace.transactions.map(row => [row.id, row.description || row.payee || row.type])),
    tasks: Object.fromEntries(workspace.tasks.map(row => [row.id, row.title])),
    milestones: Object.fromEntries(workspace.milestones.map(row => [row.id, row.title])),
    budgets: Object.fromEntries(workspace.budgets.map(row => [row.id, `${categoryNames[row.category_id] ?? 'Ngân sách'} (${row.month_start.slice(0, 7)})`])),
  };

  return { key, config, rows: rows as Record<string, Json | undefined>[], properties, views, options, tags, lookups };
}

export type DatabasePayload = Awaited<ReturnType<typeof loadDatabase>>;
