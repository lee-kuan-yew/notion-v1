export type Platform = 'mac' | 'other';

export interface ShortcutSpec {
  id: string;
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  scope: 'global' | 'editor' | 'table';
  notes?: string;
}

export interface KeyEventLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

export function detectPlatform(userAgentOrPlatform?: string): Platform {
  const source =
    userAgentOrPlatform ??
    (typeof navigator !== 'undefined'
      ? `${(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? ''} ${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`
      : '');
  return /mac|iphone|ipad|ipod/i.test(source) ? 'mac' : 'other';
}

export function isComposingEvent(event: Pick<KeyEventLike, 'isComposing' | 'keyCode'>): boolean {
  return Boolean(event.isComposing) || event.keyCode === 229;
}

export function isPrimaryModifierPressed(event: Pick<KeyEventLike, 'metaKey' | 'ctrlKey'>, platform: Platform): boolean {
  return platform === 'mac' ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

export function matchShortcut(
  event: KeyEventLike,
  spec: Pick<ShortcutSpec, 'key' | 'mod' | 'shift' | 'alt'>,
  platform: Platform
): boolean {
  if (isComposingEvent(event)) return false;
  const needMod = Boolean(spec.mod);
  const needShift = Boolean(spec.shift);
  const needAlt = Boolean(spec.alt);
  if (needMod) {
    if (!isPrimaryModifierPressed(event, platform)) return false;
  } else if (event.metaKey || event.ctrlKey) {
    return false;
  }
  if (event.shiftKey !== needShift) return false;
  if (event.altKey !== needAlt) return false;
  return event.key.toLowerCase() === spec.key.toLowerCase();
}

export function formatShortcut(
  spec: Pick<ShortcutSpec, 'key' | 'mod' | 'shift' | 'alt'>,
  platform: Platform
): string {
  const parts: string[] = [];
  if (spec.mod) parts.push(platform === 'mac' ? '⌘' : 'Ctrl');
  if (spec.shift) parts.push(platform === 'mac' ? '⇧' : 'Shift');
  if (spec.alt) parts.push(platform === 'mac' ? '⌥' : 'Alt');
  const displayKey =
    spec.key === 'Enter'
      ? platform === 'mac'
        ? '↵'
        : 'Enter'
      : spec.key === 'Escape'
        ? 'Esc'
        : spec.key === 'ArrowKeys'
          ? '↑ ↓ ← →'
          : spec.key.length === 1
            ? spec.key.toUpperCase()
            : spec.key;
  parts.push(displayKey);
  return platform === 'mac' ? parts.join(' ') : parts.join(' + ');
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean; closest?: (s: string) => unknown };
  const tag = (el.tagName ?? '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  if (typeof el.closest === 'function' && el.closest('[contenteditable="true"], .bn-editor')) return true;
  return false;
}

export function isInsideBlockEditor(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { closest?: (s: string) => unknown };
  return typeof el.closest === 'function' && Boolean(el.closest('.bn-editor, [data-block-editor="true"]'));
}

export const SHORTCUT_CATALOG: ShortcutSpec[] = [
  // Global
  { id: 'quick-search', key: 'p', mod: true, scope: 'global', description: 'Mở tìm kiếm nhanh (Quick Search)' },
  { id: 'new-page', key: 'n', mod: true, scope: 'global', description: 'Tạo trang mới', notes: 'Một số trình duyệt giữ phím này để mở cửa sổ mới; có thể dùng nút + Tạo nhanh' },
  { id: 'toggle-theme', key: 'l', mod: true, shift: true, scope: 'global', description: 'Chuyển giao diện Sáng / Tối' },
  { id: 'duplicate-item', key: 'd', mod: true, scope: 'global', description: 'Nhân bản khối (trong editor) hoặc hàng đang chọn (trong bảng)' },
  { id: 'block-actions', key: '/', mod: true, scope: 'global', description: 'Mở menu thao tác khối trong trình soạn thảo' },
  { id: 'open-or-commit', key: 'Enter', mod: true, scope: 'global', description: 'Mở trang chi tiết / Lưu ô đang sửa / Bật-tắt việc cần làm' },

  // Editor
  { id: 'editor-bold', key: 'b', mod: true, scope: 'editor', description: 'In đậm văn bản' },
  { id: 'editor-italic', key: 'i', mod: true, scope: 'editor', description: 'In nghiêng văn bản' },
  { id: 'editor-link', key: 'k', mod: true, scope: 'editor', description: 'Chèn hoặc chỉnh sửa liên kết' },
  { id: 'editor-slash', key: '/', scope: 'editor', description: 'Mở menu lệnh Slash (/h1, /todo, /database, /table, ...)' },
  { id: 'editor-escape', key: 'Escape', scope: 'editor', description: 'Đóng menu lệnh hoặc hộp thoại đang mở' },

  // Table
  { id: 'table-next', key: 'Tab', scope: 'table', description: 'Chuyển sang ô có thể sửa tiếp theo' },
  { id: 'table-prev', key: 'Tab', shift: true, scope: 'table', description: 'Quay lại ô có thể sửa trước đó' },
  { id: 'table-enter', key: 'Enter', scope: 'table', description: 'Bắt đầu sửa ô hoặc mở chi tiết bản ghi' },
  { id: 'table-escape', key: 'Escape', scope: 'table', description: 'Hủy chỉnh sửa ô và quay lại điều hướng' },
  { id: 'table-arrows', key: 'ArrowKeys', scope: 'table', description: 'Di chuyển giữa các ô ở chế độ điều hướng bảng' },
  { id: 'table-save', key: 'Enter', mod: true, scope: 'table', description: 'Lưu và kết thúc chỉnh sửa ô / mở trang bản ghi' },
];
