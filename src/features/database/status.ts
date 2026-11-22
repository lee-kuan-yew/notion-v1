import { label } from '@/components/shared/format';
import { databaseConfig } from './config';
import { propertyValue, type DataRow } from './rules';
import type { DatabaseKey, DatabaseProperty, PropertyOption, StatusGroup } from '@/types/database';

export type StatusMeta = {
  value: string;
  label: string;
  color: string;
  group: StatusGroup;
};

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  todo: 'Cần làm (To-do)',
  in_progress: 'Đang làm (In Progress)',
  complete: 'Hoàn tất (Complete)',
};

export const STATUS_GROUP_ORDER: StatusGroup[] = ['todo', 'in_progress', 'complete'];

export const SYSTEM_STATUS_DEFAULTS: Record<'projects' | 'tasks' | 'milestones', StatusMeta[]> = {
  projects: [
    { value: 'idea', label: 'Ý tưởng', color: '#78716C', group: 'todo' },
    { value: 'planning', label: 'Lên kế hoạch', color: '#7C3AED', group: 'todo' },
    { value: 'active', label: 'Đang chạy', color: '#2563EB', group: 'in_progress' },
    { value: 'on_hold', label: 'Tạm dừng', color: '#D97706', group: 'in_progress' },
    { value: 'completed', label: 'Hoàn tất', color: '#16A34A', group: 'complete' },
    { value: 'archived', label: 'Lưu trữ', color: '#57534E', group: 'complete' },
  ],
  tasks: [
    { value: 'backlog', label: 'Backlog', color: '#78716C', group: 'todo' },
    { value: 'todo', label: 'Cần làm', color: '#57534E', group: 'todo' },
    { value: 'in_progress', label: 'Đang làm', color: '#2563EB', group: 'in_progress' },
    { value: 'review', label: 'Duyệt', color: '#7C3AED', group: 'in_progress' },
    { value: 'done', label: 'Hoàn tất', color: '#16A34A', group: 'complete' },
    { value: 'cancelled', label: 'Hủy', color: '#DC2626', group: 'complete' },
  ],
  milestones: [
    { value: 'pending', label: 'Chờ', color: '#78716C', group: 'todo' },
    { value: 'in_progress', label: 'Đang làm', color: '#2563EB', group: 'in_progress' },
    { value: 'completed', label: 'Hoàn tất', color: '#16A34A', group: 'complete' },
  ],
};

export const SYSTEM_SELECT_CHOICES: Record<string, { value: string; label: string; color: string }[]> = {
  priority: [
    { value: 'low', label: 'Thấp', color: '#78716C' },
    { value: 'medium', label: 'Vừa', color: '#0891B2' },
    { value: 'high', label: 'Cao', color: '#EA580C' },
    { value: 'urgent', label: 'Khẩn', color: '#DC2626' },
  ],
  account_type: [
    { value: 'bank', label: 'Ngân hàng', color: '#2563EB' },
    { value: 'cash', label: 'Tiền mặt', color: '#16A34A' },
    { value: 'e_wallet', label: 'Ví điện tử', color: '#D97706' },
    { value: 'savings', label: 'Tiết kiệm', color: '#7C3AED' },
    { value: 'other', label: 'Khác', color: '#78716C' },
  ],
  kind: [
    { value: 'income', label: 'Thu', color: '#16A34A' },
    { value: 'expense', label: 'Chi', color: '#DC2626' },
  ],
  type: [
    { value: 'income', label: 'Thu', color: '#16A34A' },
    { value: 'expense', label: 'Chi', color: '#DC2626' },
    { value: 'transfer', label: 'Chuyển', color: '#2563EB' },
  ],
};

export function getSystemStatusOptions(databaseKey: DatabaseKey, property?: DatabaseProperty): StatusMeta[] {
  if (!(databaseKey in SYSTEM_STATUS_DEFAULTS)) return [];
  const defaults = SYSTEM_STATUS_DEFAULTS[databaseKey as 'projects' | 'tasks' | 'milestones'];
  const overrides = property?.configuration?.status_options;
  const map =
    overrides && typeof overrides === 'object' && !Array.isArray(overrides)
      ? (overrides as Record<string, { label?: string; color?: string; group?: StatusGroup }>)
      : {};

  return defaults.map(item => {
    const custom = map[item.value];
    return {
      value: item.value,
      label: typeof custom?.label === 'string' && custom.label.trim() ? custom.label.trim() : item.label,
      color: typeof custom?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(custom.color) ? custom.color : item.color,
      group: custom?.group && STATUS_GROUP_ORDER.includes(custom.group) ? custom.group : item.group,
    };
  });
}

export function resolveStatusOrSelectDisplay(
  databaseKey: DatabaseKey,
  property: DatabaseProperty,
  value: string,
  options: PropertyOption[]
): { label: string; color?: string; group?: StatusGroup } {
  if (property.is_system_property && property.property_type === 'status') {
    const found = getSystemStatusOptions(databaseKey, property).find(item => item.value === value);
    if (found) return { label: found.label, color: found.color, group: found.group };
  }
  if (property.is_system_property && property.property_key in SYSTEM_SELECT_CHOICES) {
    const found = SYSTEM_SELECT_CHOICES[property.property_key].find(item => item.value === value);
    if (found) return { label: found.label, color: found.color };
  }
  const custom = options.find(opt => opt.id === value && opt.property_id === property.id);
  if (custom) return { label: custom.label, color: custom.color, group: custom.status_group };
  return { label: label(value) };
}

export function rowTitle(row: DataRow, databaseKey: DatabaseKey, lookups: Record<string, Record<string, string>>): string {
  if (databaseKey === 'budgets') {
    const categoryName = lookups.categories?.[String(row.category_id ?? '')] ?? 'Ngân sách';
    const month = String(row.month_start ?? '').slice(0, 7);
    return month ? `${categoryName} (${month})` : categoryName;
  }
  const titleKey = databaseConfig[databaseKey].titleKey;
  const raw = propertyValue(row, titleKey);
  if (raw != null && String(raw).trim() !== '') return String(raw);
  if (databaseKey === 'transactions') {
    return String(row.payee ?? '').trim() || label(String(row.type ?? 'Giao dịch'));
  }
  return 'Không có tiêu đề';
}
