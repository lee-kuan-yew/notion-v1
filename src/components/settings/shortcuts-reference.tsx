'use client';
import { useState } from 'react';
import { SHORTCUT_CATALOG, detectPlatform, formatShortcut, type Platform } from '@/lib/shortcuts';

const scopeMeta = [
  { scope: 'global' as const, title: 'Phím tắt toàn cục (Global)', description: 'Hoạt động trên toàn không gian làm việc Finanion.' },
  { scope: 'editor' as const, title: 'Trình soạn thảo (BlockNote Editor)', description: 'Định dạng văn bản, mở lệnh Slash và thao tác khối.' },
  { scope: 'table' as const, title: 'Bảng dữ liệu (Database Table)', description: 'Điều hướng ô và chỉnh sửa trực tiếp bằng bàn phím.' },
];

export function ShortcutsReference() {
  const [platform, setPlatform] = useState<Platform>(() => detectPlatform());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        <div>
          <p className="font-medium">Bố cục hệ điều hành</p>
          <p className="text-xs text-muted">
            Hệ thống tự nhận diện macOS (Command ⌘) và Windows/Linux (Control Ctrl). Bạn có thể chuyển để xem trước bố cục khác.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-soft p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${platform === 'mac' ? 'bg-surface shadow-sm' : 'text-muted'}`}
            onClick={() => setPlatform('mac')}
          >
            macOS (⌘)
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${platform === 'other' ? 'bg-surface shadow-sm' : 'text-muted'}`}
            onClick={() => setPlatform('other')}
          >
            Windows / Linux (Ctrl)
          </button>
        </div>
      </div>

      {scopeMeta.map(({ scope, title, description }) => {
        const rows = SHORTCUT_CATALOG.filter(item => item.scope === scope);
        return (
          <section key={scope} className="card overflow-hidden">
            <div className="border-b border-line bg-soft/60 px-5 py-3">
              <h2 className="font-semibold">{title}</h2>
              <p className="text-xs text-muted">{description}</p>
            </div>
            <div className="divide-y divide-line">
              {rows.map(item => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm">{item.description}</p>
                    {item.notes && <p className="text-xs text-muted">{item.notes}</p>}
                  </div>
                  <kbd
                    className="rounded-md border border-line bg-soft px-2.5 py-1 font-mono text-xs font-semibold text-ink"
                    suppressHydrationWarning
                  >
                    {formatShortcut(item, platform)}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="card p-5 text-sm">
        <h2 className="font-semibold">Tương thích bộ gõ tiếng Việt (IME)</h2>
        <p className="mt-1 text-muted">
          Mọi phím tắt đều bỏ qua sự kiện khi bộ gõ IME đang tổ hợp dấu (Telex / VNI) và không chặn phím khi đang nhập liệu trong các trường không liên quan.
        </p>
      </section>
    </div>
  );
}
