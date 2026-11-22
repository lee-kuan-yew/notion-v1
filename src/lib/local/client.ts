import 'server-only';
import type { PGlite } from '@electric-sql/pglite';
import { getLocalDb } from './db';
import { LOCAL_OWNER_ID } from './mode';

type Row = Record<string, unknown>;
type LocalResult = { data: Row[] | Row | null; error: { message: string } | null };
const parameter = (value: unknown) => value !== null && typeof value === 'object' && !(value instanceof Date) ? JSON.stringify(value) : value;
const tables = new Set(['profiles', 'accounts', 'categories', 'transactions', 'budgets', 'projects', 'tasks', 'milestones', 'database_properties', 'database_property_options', 'database_views', 'tag_options', 'account_tags', 'category_tags', 'transaction_tags', 'budget_tags', 'project_tags', 'task_tags', 'milestone_tags', 'pages', 'record_documents', 'media_assets']);
const functions: Record<string, string[]> = {
  initialize_owner: [], account_balances: [], project_spending: [],
  project_spending_period: ['p_start', 'p_end'], budget_actuals: ['p_month'],
  budget_month_totals: ['p_month'], period_totals: ['p_start', 'p_end'],
  monthly_report: ['p_start', 'p_end'], expense_categories: ['p_start', 'p_end'],
  reorder_tasks: ['p_updates'],
  set_custom_property: ['p_database_key','p_record_id','p_property_key','p_value'],
  delete_custom_property: ['p_property_id'],
  bulk_delete_records: ['p_database_key','p_record_ids'],
  bulk_update_records: ['p_database_key','p_record_ids','p_property_key','p_value'],
  convert_custom_property_type: ['p_property_id','p_new_type','p_new_name','p_visible','p_position','p_configuration'],
};
const jsonbArgs: Record<string, Set<number>> = {
  reorder_tasks: new Set([0]),
  set_custom_property: new Set([3]),
  bulk_delete_records: new Set([1]),
  bulk_update_records: new Set([1, 3]),
  convert_custom_property_type: new Set([5]),
};
const dateColumns = new Set(['opening_balance_date', 'transaction_date', 'month_start', 'start_date', 'due_date']);
function identifier(value: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error('Invalid database identifier');
  return value;
}
function normalize(row: Row): Row {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? (dateColumns.has(key) ? value.toISOString().slice(0, 10) : value.toISOString()) : value]));
}
function failure(error: unknown): LocalResult {
  return { data: null, error: { message: error instanceof Error ? error.message : 'Local database error' } };
}

class LocalQuery {
  private filters: { column: string; value: unknown }[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  constructor(private db: Promise<PGlite>, private table: string, private operation: 'select' | 'update' | 'delete', private payload?: Row, private projection = '*') {}
  eq(column: string, value: unknown) { this.filters.push({ column: identifier(column), value }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orders.push({ column: identifier(column), ascending: options?.ascending !== false }); return this; }
  single() { return this.run(true); }
  then<TResult1 = LocalResult, TResult2 = never>(onfulfilled?: ((value: LocalResult) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
  private async run(single = false): Promise<LocalResult> {
    try {
      const db = await this.db;
      const values: unknown[] = [];
      const where = this.filters.length ? ` where ${this.filters.map(item => { values.push(item.value); return `${item.column} = $${values.length}`; }).join(' and ')}` : '';
      let sql: string;
      if (this.operation === 'select') {
        const fields = this.projection === '*' ? '*' : this.projection.split(',').map(item => identifier(item.trim())).join(',');
        const order = this.orders.length ? ` order by ${this.orders.map(item => `${item.column} ${item.ascending ? 'asc' : 'desc'}`).join(',')}` : '';
        sql = `select ${fields} from public.${this.table}${where}${order}`;
      } else {
        if (!this.filters.length) throw new Error('A local mutation requires an ownership filter');
        if (this.operation === 'delete') sql = `delete from public.${this.table}${where}`;
        else {
          const entries = Object.entries(this.payload ?? {});
          if (!entries.length) throw new Error('Empty update');
          const sets = entries.map(([key, value]) => { values.push(value); return `${identifier(key)} = $${values.length}`; }).join(',');
          sql = `update public.${this.table} set ${sets}${where}`;
        }
      }
      const result = await db.query<Row>(sql, values.map(parameter));
      if (this.operation !== 'select') return { data: null, error: null };
      const rows = result.rows.map(normalize);
      if (single) return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'Record not found' } };
      return { data: rows, error: null };
    } catch (error) { return failure(error); }
  }
}

export function createLocalClient() {
  const db = getLocalDb();
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: LOCAL_OWNER_ID, email: 'local@personal.os' } }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from(table: string) {
      if (!tables.has(table)) throw new Error('Unknown table');
      return {
        select(projection = '*') { return new LocalQuery(db, table, 'select', undefined, projection); },
        insert: async (payload: Row | Row[]): Promise<LocalResult> => {
          try {
            const rows = Array.isArray(payload) ? payload : [payload];
            if (!rows.length) return { data: null, error: null };
            const columns = Object.keys(rows[0]).map(identifier);
            const values = rows.flatMap(row => columns.map(key => parameter(row[key])));
            const tuples = rows.map((_, rowIndex) => `(${columns.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`).join(',')})`);
            await (await db).query(`insert into public.${table}(${columns.join(',')}) values ${tuples.join(',')}`, values);
            return { data: null, error: null };
          } catch (error) { return failure(error); }
        },
        update(payload: Row) { return new LocalQuery(db, table, 'update', payload); },
        delete() { return new LocalQuery(db, table, 'delete'); },
      };
    },
    async rpc(name: string, args: Record<string, unknown> = {}): Promise<LocalResult> {
      if (!(name in functions)) return failure(new Error('Unknown function'));
      try {
        const keys = functions[name];
        const jsonbIndexes = jsonbArgs[name] ?? new Set<number>();
        const values = keys.map((key, index) => jsonbIndexes.has(index) ? JSON.stringify(args[key] ?? null) : args[key]);
        const placeholders = keys.map((_, index) => `$${index + 1}${jsonbIndexes.has(index) ? '::jsonb' : ''}`);
        const result = await (await db).query<Row>(`select * from public.${name}(${placeholders.join(',')})`, values.map(parameter));
        return { data: result.rows.map(normalize), error: null };
      } catch (error) { return failure(error); }
    },
  };
}
