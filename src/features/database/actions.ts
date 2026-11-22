'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { databaseConfig, mutableFields, tagTable } from './config';
import { validateFormula } from './formula';
import { filterSchema, sortsSchema, validateRules } from './rules';
import type { DatabaseKey, DatabaseProperty, Json, StatusGroup, Task, Transaction } from '@/types/database';

const keySchema = z.enum(['transactions', 'accounts', 'budgets', 'categories', 'projects', 'tasks', 'milestones']);
const idSchema = z.uuid();
const nameSchema = z.string().trim().min(1).max(120);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const statusGroupSchema = z.enum(['todo', 'in_progress', 'complete']);
const propertyTypeSchema = z.enum([
  'title',
  'text',
  'number',
  'currency',
  'select',
  'multi_select',
  'status',
  'date',
  'checkbox',
  'relation',
  'url',
  'formula',
  'created_time',
  'last_edited_time',
]);
const cellSchema = z.object({
  databaseKey: keySchema,
  recordId: idSchema,
  propertyKey: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  value: z.unknown(),
});
type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: unknown): Result<never> => ({
  ok: false,
  error: error instanceof Error ? error.message : 'Không thể lưu thay đổi',
});
const success = <T>(value: T): Result<T> => ({ ok: true, value });

const requiredText = (value: unknown) => nameSchema.parse(value);
const optionalText = (value: unknown) => z.string().max(1000).parse(value ?? '');
const decimal = (value: unknown, opts: { positive?: boolean; allowNegative?: boolean } = {}) => {
  const text = String(value ?? '').trim().replace(/[,\s]/g, '');
  const num = Number(text);
  if (!/^-?\d{1,13}(\.\d{1,2})?$/.test(text) || !Number.isFinite(num)) {
    throw new Error('Giá trị số không hợp lệ');
  }
  if (opts.positive && num <= 0) throw new Error('Số tiền phải lớn hơn 0');
  if (!opts.allowNegative && !opts.positive && num < 0) throw new Error('Giá trị không được âm');
  return text;
};

function systemValue(key: DatabaseKey, field: string, value: unknown) {
  if (!mutableFields[key].includes(field)) {
    throw new Error('Thuộc tính này chỉ đọc hoặc cần sửa trong biểu mẫu đầy đủ');
  }
  if (['name', 'title'].includes(field)) return requiredText(value);
  if (['description', 'payee'].includes(field)) {
    const text = optionalText(value);
    return field === 'payee' && text === '' ? null : text;
  }
  if (['amount', 'opening_balance', 'budget_amount', 'estimated_cost'].includes(field)) {
    if ((value === '' || value === null) && ['budget_amount', 'estimated_cost'].includes(field)) return null;
    return decimal(value, {
      positive: field === 'amount',
      allowNegative: field === 'opening_balance',
    });
  }
  if (['transaction_date', 'opening_balance_date', 'month_start', 'start_date', 'due_date'].includes(field)) {
    if ((value === '' || value === null) && ['start_date', 'due_date'].includes(field)) return null;
    const parsed = z.iso.date().parse(value);
    if (field === 'month_start' && !parsed.endsWith('-01')) {
      throw new Error('Ngày ngân sách phải là đầu tháng (ngày 01)');
    }
    return parsed;
  }
  if (field === 'is_archived') {
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return z.boolean().parse(value);
  }
  if (field === 'color') return colorSchema.parse(value);
  const enums: Record<string, string[]> = {
    account_type: ['bank', 'cash', 'e_wallet', 'savings', 'other'],
    status:
      key === 'projects'
        ? ['idea', 'planning', 'active', 'on_hold', 'completed', 'archived']
        : key === 'milestones'
          ? ['pending', 'in_progress', 'completed']
          : ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'],
    priority: ['low', 'medium', 'high', 'urgent'],
  };
  if (enums[field]) return z.enum(enums[field] as [string, ...string[]]).parse(value);
  if (['project_id', 'category_id', 'parent_id', 'account_id'].includes(field)) {
    if (value === '' || value === null) {
      if (
        (key === 'budgets' && field === 'category_id') ||
        (key === 'milestones' && field === 'project_id') ||
        (key === 'transactions' && ['account_id', 'category_id'].includes(field))
      ) {
        throw new Error('Trường này là bắt buộc');
      }
      return null;
    }
    return idSchema.parse(value);
  }
  throw new Error('Không thể sửa trực tiếp thuộc tính này');
}

async function validateTransactionInlineEdit(
  record: Transaction,
  field: string,
  parsedValue: unknown,
  userId: string,
  client: Awaited<ReturnType<typeof requireOwner>>['supabase']
) {
  if (record.type === 'transfer' && ['account_id', 'category_id', 'project_id'].includes(field)) {
    throw new Error('Giao dịch chuyển tiền cần chỉnh sửa tài khoản trong biểu mẫu đầy đủ');
  }
  if (field === 'project_id' && parsedValue !== null && record.type !== 'expense') {
    throw new Error('Chỉ giao dịch chi tiêu mới có thể gắn với dự án');
  }
  if (field === 'category_id' && typeof parsedValue === 'string') {
    const cat = await client.from('categories').select('id,kind').eq('id', parsedValue).eq('user_id', userId).single();
    if (cat.error || !cat.data) throw new Error('Danh mục không tồn tại');
    if (cat.data.kind !== record.type) {
      throw new Error(`Danh mục phải thuộc loại ${record.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}`);
    }
  }
  if (field === 'account_id' && typeof parsedValue === 'string') {
    const acc = await client.from('accounts').select('id').eq('id', parsedValue).eq('user_id', userId).single();
    if (acc.error || !acc.data) throw new Error('Tài khoản không tồn tại');
  }
  if (field === 'project_id' && typeof parsedValue === 'string') {
    const proj = await client.from('projects').select('id').eq('id', parsedValue).eq('user_id', userId).single();
    if (proj.error || !proj.data) throw new Error('Dự án không tồn tại');
  }
}

async function customValue(
  property: DatabaseProperty,
  value: unknown,
  userId: string,
  client: Awaited<ReturnType<typeof requireOwner>>['supabase']
) {
  const type = property.property_type;
  if (value === null || value === '') return null;
  if (['title', 'text', 'url'].includes(type)) {
    const text = z.string().max(2000).parse(value);
    if (type === 'url' && text && !/^https?:\/\//i.test(text)) {
      throw new Error('URL phải bắt đầu bằng http:// hoặc https://');
    }
    return text;
  }
  if (['number', 'currency'].includes(type)) return Number(decimal(value, { allowNegative: true }));
  if (type === 'date') return z.iso.date().parse(value);
  if (type === 'checkbox') {
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return z.boolean().parse(value);
  }
  if (['select', 'status', 'multi_select'].includes(type)) {
    const values = type === 'multi_select' ? z.array(idSchema).max(30).parse(value) : [idSchema.parse(value)];
    const options = await client
      .from('database_property_options')
      .select('id')
      .eq('property_id', property.id)
      .eq('user_id', userId);
    if (options.error) throw new Error(options.error.message);
    const ids = new Set(options.data.map(option => option.id));
    if (values.some(id => !ids.has(id))) throw new Error('Lựa chọn không hợp lệ');
    return type === 'multi_select' ? values : values[0];
  }
  if (type === 'relation') {
    const target = String(property.configuration.target ?? '');
    if (!keySchema.safeParse(target).success) throw new Error('Chưa cấu hình bảng liên kết');
    const relationId = idSchema.parse(value);
    const result = await client.from(target as 'tasks').select('id').eq('id', relationId).eq('user_id', userId).single();
    if (result.error || !result.data) throw new Error('Bản ghi liên kết không tồn tại');
    return relationId;
  }
  throw new Error('Thuộc tính này chỉ đọc');
}

export async function saveDatabaseCell(input: unknown): Promise<Result<unknown>> {
  try {
    const { databaseKey, recordId, propertyKey, value } = cellSchema.parse(input);
    const { supabase, user } = await requireOwner();
    const propertyResult = await supabase
      .from('database_properties')
      .select('*')
      .eq('database_key', databaseKey)
      .eq('property_key', propertyKey)
      .eq('user_id', user.id)
      .single();
    if (propertyResult.error || !propertyResult.data) throw new Error('Thuộc tính không tồn tại');
    const property = propertyResult.data;
    const recordResult = await supabase
      .from(databaseKey as 'tasks')
      .select('*')
      .eq('id', recordId)
      .eq('user_id', user.id)
      .single();
    if (recordResult.error || !recordResult.data) throw new Error('Bản ghi không tồn tại');

    if (property.is_system_property) {
      const parsed = systemValue(databaseKey, propertyKey, value);
      if (databaseKey === 'transactions') {
        await validateTransactionInlineEdit(
          recordResult.data as unknown as Transaction,
          propertyKey,
          parsed,
          user.id,
          supabase
        );
      }
      const result = await supabase
        .from(databaseKey as 'tasks')
        .update({ [propertyKey]: parsed } as Partial<Task>)
        .eq('id', recordId)
        .eq('user_id', user.id);
      if (result.error) throw new Error(result.error.message);
      revalidatePath('/app', 'layout');
      return success(parsed);
    }

    const parsed = await customValue(property, value, user.id, supabase);
    const result = await supabase.rpc('set_custom_property', {
      p_database_key: databaseKey,
      p_record_id: recordId,
      p_property_key: propertyKey,
      p_value: parsed as Json,
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/app/database/${databaseKey}`);
    return success(parsed);
  } catch (error) {
    return fail(error);
  }
}

export async function bulkUpdateDatabaseRows(input: unknown): Promise<Result<unknown>> {
  try {
    const v = z
      .object({
        databaseKey: keySchema,
        recordIds: z.array(idSchema).min(1).max(100),
        propertyKey: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
        value: z.unknown(),
      })
      .parse(input);
    const { supabase, user } = await requireOwner();
    const propertyResult = await supabase
      .from('database_properties')
      .select('*')
      .eq('database_key', v.databaseKey)
      .eq('property_key', v.propertyKey)
      .eq('user_id', user.id)
      .single();
    if (propertyResult.error || !propertyResult.data) throw new Error('Thuộc tính không tồn tại');
    const property = propertyResult.data;

    let parsed: unknown;
    if (property.is_system_property) {
      parsed = systemValue(v.databaseKey, v.propertyKey, v.value);
      if (v.databaseKey === 'transactions' && ['account_id', 'category_id', 'project_id'].includes(v.propertyKey)) {
        const recordsResult = await supabase.from('transactions').select('*').eq('user_id', user.id);
        if (recordsResult.error) throw new Error(recordsResult.error.message);
        const targetSet = new Set(v.recordIds);
        for (const rec of recordsResult.data.filter(r => targetSet.has(r.id))) {
          await validateTransactionInlineEdit(rec, v.propertyKey, parsed, user.id, supabase);
        }
      }
    } else {
      parsed = await customValue(property, v.value, user.id, supabase);
    }

    const result = await supabase.rpc('bulk_update_records', {
      p_database_key: v.databaseKey,
      p_record_ids: v.recordIds,
      p_property_key: v.propertyKey,
      p_value: parsed as Json,
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath('/app', 'layout');
    return success(parsed);
  } catch (error) {
    return fail(error);
  }
}

const viewSchema = z.object({
  id: idSchema.optional(),
  databaseKey: keySchema,
  viewName: nameSchema,
  viewType: z.enum(['table', 'board', 'calendar']),
  filters: filterSchema,
  sorts: sortsSchema,
  groupBy: z.string().nullable(),
  visibleProperties: z.array(z.string()).max(40),
  columnWidths: z.record(z.string(), z.number().int().min(80).max(800)),
  columnOrder: z.array(z.string()).max(40),
  configuration: z.record(z.string(), z.unknown()).default({}),
});

export async function saveDatabaseView(input: unknown): Promise<Result<string>> {
  try {
    const v = viewSchema.parse(input);
    const { supabase, user } = await requireOwner();
    const propertiesResult = await supabase
      .from('database_properties')
      .select('*')
      .eq('database_key', v.databaseKey)
      .eq('user_id', user.id);
    if (propertiesResult.error) throw new Error(propertiesResult.error.message);
    const properties = propertiesResult.data;
    validateRules(v.filters, v.sorts, v.groupBy, properties);
    const keys = new Set(properties.map(p => p.property_key));
    if ([...v.visibleProperties, ...v.columnOrder, ...Object.keys(v.columnWidths)].some(key => !keys.has(key))) {
      throw new Error('Cấu hình cột không hợp lệ');
    }
    if (v.viewType === 'calendar' && !databaseConfig[v.databaseKey].dateKey) {
      throw new Error('Bảng này chưa có cột ngày');
    }
    const id = v.id ?? crypto.randomUUID();
    const payload = {
      view_name: v.viewName,
      view_type: v.viewType,
      filters: v.filters as Json,
      sorts: v.sorts as Json,
      group_by: v.groupBy,
      visible_properties: v.visibleProperties as Json,
      column_widths: v.columnWidths as Json,
      column_order: v.columnOrder as Json,
      configuration: v.configuration as Json,
    };
    const result = v.id
      ? await supabase
        .from('database_views')
        .update(payload)
        .eq('id', id)
        .eq('database_key', v.databaseKey)
        .eq('user_id', user.id)
      : await supabase.from('database_views').insert({ id, user_id: user.id, database_key: v.databaseKey, ...payload });
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/app/database/${v.databaseKey}`);
    return success(id);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDatabaseView(databaseKey: DatabaseKey, viewId: string): Promise<Result> {
  try {
    const key = keySchema.parse(databaseKey);
    const id = idSchema.parse(viewId);
    const { supabase, user } = await requireOwner();
    const result = await supabase
      .from('database_views')
      .delete()
      .eq('id', id)
      .eq('database_key', key)
      .eq('user_id', user.id);
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/app/database/${key}`);
    return success(undefined);
  } catch (error) {
    return fail(error);
  }
}

const statusOptionOverrideSchema = z.object({
  label: z.string().trim().min(1).max(80),
  color: colorSchema,
  group: statusGroupSchema,
});

const propertySchema = z.object({
  id: idSchema.optional(),
  databaseKey: keySchema,
  name: nameSchema,
  type: propertyTypeSchema,
  visible: z.boolean(),
  position: z.number().int().nonnegative().max(1000),
  configuration: z.record(z.string(), z.unknown()).default({}),
});

export async function saveDatabaseProperty(input: unknown): Promise<Result<{ id: string; propertyKey: string }>> {
  try {
    const v = propertySchema.parse(input);
    const { supabase, user } = await requireOwner();
    if (v.type === 'relation' && !keySchema.safeParse(v.configuration.target).success) {
      throw new Error('Chọn bảng liên kết');
    }
    const existingPropsResult = await supabase
      .from('database_properties')
      .select('*')
      .eq('database_key', v.databaseKey)
      .eq('user_id', user.id);
    if (existingPropsResult.error) throw new Error(existingPropsResult.error.message);
    const existingProps = existingPropsResult.data;

    const cleanConfig: Record<string, unknown> = { ...v.configuration };
    if (v.type === 'formula' && (!v.id || !existingProps.find(p => p.id === v.id)?.is_system_property)) {
      const expr = String(v.configuration.expression ?? '').trim();
      const allowedKeys = existingProps
        .filter(p => p.id !== v.id && !(p.property_type === 'formula' && !p.is_system_property))
        .map(p => p.property_key);
      validateFormula(expr, allowedKeys);
      const format = z.enum(['number', 'currency', 'percent', 'text']).catch('number').parse(v.configuration.format);
      cleanConfig.expression = expr;
      cleanConfig.format = format;
    }

    if (v.configuration.status_options && typeof v.configuration.status_options === 'object') {
      const parsedMap: Record<string, { label: string; color: string; group: StatusGroup }> = {};
      for (const [k, rawItem] of Object.entries(v.configuration.status_options as Record<string, unknown>)) {
        if (!/^[a-z_]{1,40}$/.test(k)) continue;
        parsedMap[k] = statusOptionOverrideSchema.parse(rawItem);
      }
      cleanConfig.status_options = parsedMap;
    }

    const id = v.id ?? crypto.randomUUID();
    if (v.id) {
      const current = existingProps.find(p => p.id === id);
      if (!current) throw new Error('Thuộc tính không tồn tại');
      if (current.is_system_property && v.type !== current.property_type) {
        throw new Error('Không thể đổi kiểu cột nghiệp vụ');
      }
      if (!current.is_system_property && v.type !== current.property_type) {
        const result = await supabase.rpc('convert_custom_property_type', {
          p_property_id: id,
          p_new_type: v.type,
          p_new_name: v.name,
          p_visible: v.visible,
          p_position: v.position,
          p_configuration: cleanConfig as Record<string, Json>,
        });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await supabase
          .from('database_properties')
          .update({
            property_name: v.name,
            property_type: v.type,
            position: v.position,
            configuration: cleanConfig as Record<string, Json>,
            is_visible: v.visible,
          })
          .eq('id', id)
          .eq('user_id', user.id);
        if (result.error) throw new Error(result.error.message);
      }
      revalidatePath(`/app/database/${v.databaseKey}`);
      return success({ id, propertyKey: current.property_key });
    } else {
      const propertyKey = `custom_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
      const result = await supabase.from('database_properties').insert({
        id,
        user_id: user.id,
        database_key: v.databaseKey,
        property_key: propertyKey,
        property_name: v.name,
        property_type: v.type,
        position: v.position,
        configuration: cleanConfig as Record<string, Json>,
        is_system_property: false,
        is_visible: v.visible,
      });
      if (result.error) throw new Error(result.error.message);
      revalidatePath(`/app/database/${v.databaseKey}`);
      return success({ id, propertyKey });
    }
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDatabaseProperty(databaseKey: DatabaseKey, propertyId: string): Promise<Result> {
  try {
    const key = keySchema.parse(databaseKey);
    const id = idSchema.parse(propertyId);
    const { supabase, user } = await requireOwner();
    const propRes = await supabase
      .from('database_properties')
      .select('property_key')
      .eq('id', id)
      .eq('database_key', key)
      .eq('user_id', user.id)
      .single();
    const deletedKey = propRes.data?.property_key;
    const result = await supabase.rpc('delete_custom_property', { p_property_id: id });
    if (result.error) throw new Error(result.error.message);
    if (deletedKey) {
      const viewsRes = await supabase
        .from('database_views')
        .select('*')
        .eq('database_key', key)
        .eq('user_id', user.id);
      if (!viewsRes.error && viewsRes.data) {
        for (const view of viewsRes.data) {
          const vis = Array.isArray(view.visible_properties)
            ? (view.visible_properties as string[]).filter(k => k !== deletedKey)
            : [];
          const ord = Array.isArray(view.column_order)
            ? (view.column_order as string[]).filter(k => k !== deletedKey)
            : [];
          const widths =
            view.column_widths && typeof view.column_widths === 'object' && !Array.isArray(view.column_widths)
              ? Object.fromEntries(Object.entries(view.column_widths).filter(([k]) => k !== deletedKey))
              : {};
          const groupBy = view.group_by === deletedKey ? null : view.group_by;
          await supabase
            .from('database_views')
            .update({
              visible_properties: vis as Json,
              column_order: ord as Json,
              column_widths: widths as Json,
              group_by: groupBy,
            })
            .eq('id', view.id)
            .eq('user_id', user.id);
        }
      }
    }
    revalidatePath(`/app/database/${key}`);
    return success(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function savePropertyOption(input: unknown): Promise<Result<{ id: string; label: string; color: string; position: number; status_group: StatusGroup }>> {
  try {
    const v = z
      .object({
        id: idSchema.optional(),
        propertyId: idSchema,
        label: z.string().trim().min(1).max(80),
        color: colorSchema,
        position: z.number().int().nonnegative(),
        statusGroup: statusGroupSchema.default('todo'),
      })
      .parse(input);
    const { supabase, user } = await requireOwner();
    const property = await supabase
      .from('database_properties')
      .select('*')
      .eq('id', v.propertyId)
      .eq('user_id', user.id)
      .single();
    if (property.error || !property.data || !['select', 'multi_select', 'status'].includes(property.data.property_type)) {
      throw new Error('Thuộc tính không hỗ trợ lựa chọn');
    }
    const id = v.id ?? crypto.randomUUID();
    const result = v.id
      ? await supabase
        .from('database_property_options')
        .update({ label: v.label, color: v.color, position: v.position, status_group: v.statusGroup })
        .eq('id', id)
        .eq('property_id', v.propertyId)
        .eq('user_id', user.id)
      : await supabase.from('database_property_options').insert({
        id,
        user_id: user.id,
        property_id: v.propertyId,
        label: v.label,
        color: v.color,
        position: v.position,
        status_group: v.statusGroup,
      });
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/app/database/${property.data.database_key}`);
    return success({ id, label: v.label, color: v.color, position: v.position, status_group: v.statusGroup });
  } catch (error) {
    return fail(error);
  }
}

export async function deletePropertyOption(propertyId: string, optionId: string): Promise<Result> {
  try {
    const { supabase, user } = await requireOwner();
    const property = await supabase
      .from('database_properties')
      .select('*')
      .eq('id', idSchema.parse(propertyId))
      .eq('user_id', user.id)
      .single();
    if (property.error || !property.data) throw new Error('Thuộc tính không tồn tại');
    const result = await supabase
      .from('database_property_options')
      .delete()
      .eq('id', idSchema.parse(optionId))
      .eq('property_id', propertyId)
      .eq('user_id', user.id);
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/app/database/${property.data.database_key}`);
    return success(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function saveTagOption(input: unknown): Promise<Result<string>> {
  try {
    const v = z.object({ id: idSchema.optional(), name: z.string().trim().min(1).max(80), color: colorSchema }).parse(input);
    const { supabase, user } = await requireOwner();
    const id = v.id ?? crypto.randomUUID();
    const result = v.id
      ? await supabase.from('tag_options').update({ name: v.name, color: v.color }).eq('id', id).eq('user_id', user.id)
      : await supabase.from('tag_options').insert({ id, user_id: user.id, name: v.name, color: v.color });
    if (result.error) throw new Error(result.error.message);
    revalidatePath('/app', 'layout');
    return success(id);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTagOption(tagId: string): Promise<Result> {
  try {
    const { supabase, user } = await requireOwner();
    const result = await supabase.from('tag_options').delete().eq('id', idSchema.parse(tagId)).eq('user_id', user.id);
    if (result.error) throw new Error(result.error.message);
    revalidatePath('/app', 'layout');
    return success(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function setRecordTag(
  databaseKey: DatabaseKey,
  recordId: string,
  tagId: string,
  selected: boolean
): Promise<Result> {
  try {
    const key = keySchema.parse(databaseKey);
    const record = idSchema.parse(recordId);
    const tag = idSchema.parse(tagId);
    const { supabase, user } = await requireOwner();
    const table = supabase.from(tagTable[key] as 'task_tags');
    const result = selected
      ? await table.insert({ user_id: user.id, record_id: record, tag_id: tag })
      : await table.delete().eq('record_id', record).eq('tag_id', tag).eq('user_id', user.id);
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/app/database/${key}`);
    return success(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDatabaseRows(databaseKey: DatabaseKey, recordIds: string[]): Promise<Result> {
  try {
    const key = keySchema.parse(databaseKey);
    const ids = z.array(idSchema).min(1).max(100).parse(recordIds);
    const { supabase } = await requireOwner();
    const result = await supabase.rpc('bulk_delete_records', {
      p_database_key: key,
      p_record_ids: ids,
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath('/app', 'layout');
    return success(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function duplicateDatabaseRow(databaseKey: DatabaseKey, recordId: string): Promise<Result<string>> {
  try {
    const key = keySchema.parse(databaseKey);
    const id = idSchema.parse(recordId);
    const { supabase, user } = await requireOwner();
    if (key === 'budgets') throw new Error('Ngân sách không thể nhân bản trong cùng tháng');
    const source = await supabase.from(key as 'tasks').select('*').eq('id', id).eq('user_id', user.id).single();
    if (source.error || !source.data) throw new Error('Bản ghi không tồn tại');
    const copyId = crypto.randomUUID();
    const copy = {
      ...source.data,
      id: copyId,
      user_id: user.id,
      created_at: undefined,
      updated_at: undefined,
      completed_at: undefined,
    } as Record<string, unknown>;
    delete copy.created_at;
    delete copy.updated_at;
    delete copy.completed_at;
    const title = databaseConfig[key].titleKey;
    if (typeof copy[title] === 'string') copy[title] = `${copy[title]} (bản sao)`;
    if (key === 'categories') copy.name = `${copy.name} ${Date.now()}`;
    const result = await supabase
      .from(key as 'tasks')
      .insert(copy as Partial<Task> & Pick<Task, 'user_id' | 'title'>);
    if (result.error) throw new Error(result.error.message);
    // Copy record tags if any
    const tagLinks = await supabase
      .from(tagTable[key] as 'task_tags')
      .select('tag_id')
      .eq('record_id', id)
      .eq('user_id', user.id);
    if (!tagLinks.error && tagLinks.data?.length) {
      await supabase
        .from(tagTable[key] as 'task_tags')
        .insert(tagLinks.data.map(link => ({ user_id: user.id, record_id: copyId, tag_id: link.tag_id })));
    }
    revalidatePath('/app', 'layout');
    return success(copyId);
  } catch (error) {
    return fail(error);
  }
}

export async function createPage(title = 'Không có tiêu đề'): Promise<Result<string>> {
  try {
    const { supabase, user } = await requireOwner();
    const id = crypto.randomUUID();
    const result = await supabase.from('pages').insert({ id, user_id: user.id, title: nameSchema.parse(title), content: [] });
    if (result.error) throw new Error(result.error.message);
    revalidatePath('/app/pages');
    return success(id);
  } catch (error) {
    return fail(error);
  }
}

export async function savePage(id: string, title: string, content: Json): Promise<Result> {
  try {
    const parsedId = idSchema.parse(id);
    const parsedTitle = nameSchema.parse(title);
    if (!Array.isArray(content) || JSON.stringify(content).length > 500000) {
      throw new Error('Nội dung trang không hợp lệ hoặc quá lớn');
    }
    const { supabase, user } = await requireOwner();
    const result = await supabase
      .from('pages')
      .update({ title: parsedTitle, content })
      .eq('id', parsedId)
      .eq('user_id', user.id);
    if (result.error) throw new Error(result.error.message);
    revalidatePath('/app/pages');
    revalidatePath(`/app/pages/${id}`);
    return success(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function renamePage(id: string, title: string): Promise<Result> {
  try {
    const { supabase, user } = await requireOwner();
    const result = await supabase
      .from('pages')
      .update({ title: nameSchema.parse(title) })
      .eq('id', idSchema.parse(id))
      .eq('user_id', user.id);
    if (result.error) throw new Error(result.error.message);
    revalidatePath('/app/pages');
    revalidatePath(`/app/pages/${id}`);
    return success(undefined);
  } catch (error) {
    return fail(error);
  }
}

export async function saveRecordDocument(databaseKey: DatabaseKey, recordId: string, content: Json): Promise<Result> {
  try {
    const key = keySchema.parse(databaseKey);
    const id = idSchema.parse(recordId);
    if (!Array.isArray(content) || JSON.stringify(content).length > 500000) {
      throw new Error('Nội dung không hợp lệ hoặc quá lớn');
    }
    const { supabase, user } = await requireOwner();
    const current = await supabase
      .from('record_documents')
      .select('id')
      .eq('database_key', key)
      .eq('record_id', id)
      .eq('user_id', user.id);
    if (current.error) throw new Error(current.error.message);
    const result = current.data[0]
      ? await supabase.from('record_documents').update({ content }).eq('id', current.data[0].id).eq('user_id', user.id)
      : await supabase
        .from('record_documents')
        .insert({ id: crypto.randomUUID(), user_id: user.id, database_key: key, record_id: id, content });
    if (result.error) throw new Error(result.error.message);
    revalidatePath(`/app/database/${key}/${id}`);
    return success(undefined);
  } catch (error) {
    return fail(error);
  }
}
