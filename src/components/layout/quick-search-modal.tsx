'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { isComposingEvent } from '@/lib/shortcuts';
import type { QuickSearchItem } from '@/app/api/quick-search/route';

export function QuickSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<QuickSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/quick-search?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
        .then(res => (res.ok ? res.json() : { items: [] }))
        .then((data: { items?: QuickSearchItem[] }) => {
          if (!active) return;
          setItems(data.items ?? []);
          setActiveIndex(0);
        })
        .catch(() => {
          if (active) setItems([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 120);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [open, query]);

  if (!open) return null;

  function go(href: string) {
    onClose();
    setQuery('');
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm nhanh"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <Search size={17} className="text-muted" />
          <input
            autoFocus
            className="w-full bg-transparent text-sm outline-none"
            aria-label="Tìm kiếm nhanh"
            placeholder="Tìm trang, bảng dữ liệu, dự án, công việc, giao dịch..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (isComposingEvent(event.nativeEvent)) return;
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex(i => Math.min(Math.max(items.length - 1, 0), i + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex(i => Math.max(0, i - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (items[activeIndex]) {
                  go(items[activeIndex].href);
                } else if (query.trim()) {
                  go(`/app/search?q=${encodeURIComponent(query.trim())}`);
                }
              }
            }}
          />
          <button type="button" className="rounded p-1 text-muted hover:bg-soft" aria-label="Đóng" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="max-h-96 overflow-auto p-2">
          {loading && items.length === 0 && (
            <p className="p-4 text-center text-xs text-muted">Đang tìm kiếm…</p>
          )}
          {!loading && items.length === 0 && (
            <p className="p-4 text-center text-xs text-muted">Không tìm thấy kết quả phù hợp.</p>
          )}
          {items.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                idx === activeIndex ? 'bg-soft font-medium' : 'hover:bg-soft'
              }`}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => go(item.href)}
            >
              <div className="min-w-0">
                <p className="truncate">{item.title}</p>
                <p className="truncate text-xs text-muted">{item.subtitle}</p>
              </div>
              <span className="badge shrink-0">{item.group}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line bg-soft/60 px-3 py-2 text-[11px] text-muted">
          <span>↑↓ di chuyển · Enter mở · Esc đóng</span>
          <button
            type="button"
            className="underline hover:text-ink"
            onClick={() => go(query.trim() ? `/app/search?q=${encodeURIComponent(query.trim())}` : '/app/search')}
          >
            Tìm kiếm đầy đủ
          </button>
        </div>
      </div>
    </div>
  );
}
