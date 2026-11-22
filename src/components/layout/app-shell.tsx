'use client';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Landmark,
  ChartNoAxesCombined,
  Tags,
  FolderKanban,
  ListTodo,
  Settings,
  Search,
  Plus,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  PiggyBank,
  FileText,
  Table2,
  Keyboard,
  Flag,
} from 'lucide-react';
import { signOut } from '@/app/login/actions';
import { createPage } from '@/features/database/actions';
import {
  detectPlatform,
  formatShortcut,
  isComposingEvent,
  isEditableElement,
  matchShortcut,
  type Platform,
} from '@/lib/shortcuts';

const QuickSearchModal = dynamic(
  () => import('./quick-search-modal').then(module => module.QuickSearchModal),
  { ssr: false }
);

const topItems = [
  ['/app', 'Tổng quan', LayoutDashboard],
  ['/app/pages', 'Trang & Ghi chú', FileText],
] as const;

const navGroups = [
  {
    title: 'Tài chính',
    icon: Wallet,
    items: [
      ['/app/finance', 'Tổng quan tài chính', Wallet],
      ['/app/finance/transactions', 'Giao dịch', ArrowLeftRight],
      ['/app/finance/accounts', 'Tài khoản', Landmark],
      ['/app/finance/budgets', 'Ngân sách', PiggyBank],
      ['/app/finance/categories', 'Danh mục', Tags],
      ['/app/finance/reports', 'Báo cáo', ChartNoAxesCombined],
    ],
  },
  {
    title: 'Dự án',
    icon: FolderKanban,
    items: [
      ['/app/projects', 'Dự án', FolderKanban],
      ['/app/tasks', 'Công việc', ListTodo],
    ],
  },
  {
    title: 'Databases',
    icon: Table2,
    items: [
      ['/app/database/transactions', 'DB Giao dịch', Table2],
      ['/app/database/accounts', 'DB Tài khoản', Table2],
      ['/app/database/budgets', 'DB Ngân sách', Table2],
      ['/app/database/categories', 'DB Danh mục', Table2],
      ['/app/database/projects', 'DB Dự án', Table2],
      ['/app/database/tasks', 'DB Công việc', Table2],
      ['/app/database/milestones', 'DB Cột mốc', Flag],
    ],
  },
  {
    title: 'Hệ thống',
    icon: Settings,
    items: [
      ['/app/search', 'Tìm kiếm', Search],
      ['/app/settings', 'Cài đặt', Settings],
      ['/app/settings/shortcuts', 'Phím tắt', Keyboard],
    ],
  },
] as const;

function isActivePath(path: string, href: string) {
  return path === href || (href !== '/app' && href !== '/app/settings' && path.startsWith(`${href}/`));
}

export function AppShell({ children, localMode = false }: { children: React.ReactNode; localMode?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [quick, setQuick] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [platform] = useState<Platform>(() => detectPlatform());
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const handleCreatePage = useCallback(async () => {
    setQuick(false);
    const result = await createPage();
    if (result.ok) {
      router.push(`/app/pages/${result.value}`);
    } else {
      toast.error(result.error);
    }
  }, [router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isComposingEvent(event)) return;

      // Cmd/Ctrl + P: Quick Search (allowed even when focus is inside inputs/editor)
      if (matchShortcut(event, { key: 'p', mod: true }, platform)) {
        event.preventDefault();
        setQuick(false);
        setSearchOpen(prev => !prev);
        return;
      }

      // Cmd/Ctrl + Shift + L: Toggle Theme
      if (matchShortcut(event, { key: 'l', mod: true, shift: true }, platform)) {
        event.preventDefault();
        toggleTheme();
        return;
      }

      // Cmd/Ctrl + N: New Page (ignore when typing in unrelated form input)
      if (matchShortcut(event, { key: 'n', mod: true }, platform)) {
        if (isEditableElement(event.target)) return;
        event.preventDefault();
        void handleCreatePage();
        return;
      }

      if (event.key === 'Escape' && quick) {
        setQuick(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [platform, toggleTheme, handleCreatePage, quick]);

  const searchHint = formatShortcut({ key: 'p', mod: true }, platform);
  const newPageHint = formatShortcut({ key: 'n', mod: true }, platform);
  const themeHint = formatShortcut({ key: 'l', mod: true, shift: true }, platform);

  const nav = (
    <>
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/app" prefetch={false} className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center">
            <Image src="/logo.png" alt="" width={28} height={28} className="size-7 dark:invert" priority />
          </span>
          <span className={collapsed ? 'md:hidden' : ''}>Finanion</span>
        </Link>
        <button type="button" className="md:hidden" aria-label="Đóng menu" onClick={() => setMobile(false)}>
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 overflow-auto px-2 pb-5 pt-3">
        {topItems.map(([href, itemLabel, Icon]) => {
          const active = isActivePath(path, href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              title={itemLabel}
              onClick={() => setMobile(false)}
              className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] ${
                active ? 'bg-soft font-semibold text-ink' : 'text-muted hover:bg-soft hover:text-ink'
              }`}
            >
              <Icon size={16} />
              <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{itemLabel}</span>
            </Link>
          );
        })}
        <div className="my-3 border-t border-line" />
        {navGroups.map(group => {
          const groupActive = group.items.some(([href]) => isActivePath(path, href));
          const GroupIcon = group.icon;
          const groupKey = `${path}:${group.title}`;
          return (
            <details
              key={groupKey}
              className="group mb-1"
              open={openGroups[groupKey] ?? groupActive}
              onToggle={event => {
                const open = event.currentTarget.open;
                setOpenGroups(current => current[groupKey] === open ? current : { ...current, [groupKey]: open });
              }}
            >
              <summary
                title={group.title}
                className={`flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 text-[13px] [&::-webkit-details-marker]:hidden ${
                  groupActive ? 'font-semibold text-ink' : 'text-muted hover:bg-soft hover:text-ink'
                }`}
              >
                <GroupIcon size={16} />
                <span className={`min-w-0 flex-1 truncate ${collapsed ? 'md:hidden' : ''}`}>{group.title}</span>
                <ChevronDown size={14} className={`transition-transform group-open:rotate-180 ${collapsed ? 'md:hidden' : ''}`} />
              </summary>
              <div className={`mt-0.5 ${collapsed ? 'md:hidden' : ''}`}>
                {group.items.map(([href, itemLabel, Icon]) => {
                  const active = isActivePath(path, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      prefetch={false}
                      title={itemLabel}
                      onClick={() => setMobile(false)}
                      className={`mb-0.5 flex items-center gap-2.5 rounded-lg py-1.5 pl-9 pr-3 text-[13px] ${
                        active ? 'bg-soft font-semibold text-ink' : 'text-muted hover:bg-soft hover:text-ink'
                      }`}
                    >
                      <Icon size={14} />
                      <span className="truncate">{itemLabel}</span>
                    </Link>
                  );
                })}
              </div>
            </details>
          );
        })}
      </nav>
      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden w-full items-center gap-2 rounded-lg px-2 py-2 text-muted hover:bg-soft md:flex"
        >
          <ChevronDown size={16} className={collapsed ? '-rotate-90' : 'rotate-90'} />
          {!collapsed && 'Thu gọn'}
        </button>
        {!localMode && (
          <form action={signOut}>
            <button className="w-full rounded-lg px-2 py-2 text-left text-muted hover:bg-soft">
              {collapsed ? '↪' : 'Đăng xuất'}
            </button>
          </form>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line bg-surface transition-all md:flex ${
          collapsed ? 'md:w-16' : 'md:w-[248px]'
        } ${mobile ? 'w-[248px]' : 'hidden'}`}
      >
        {nav}
      </aside>
      {mobile && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          aria-label="Đóng menu"
          onClick={() => setMobile(false)}
        />
      )}
      <div className={`transition-all ${collapsed ? 'md:pl-16' : 'md:pl-[248px]'}`}>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-7">
          <button type="button" className="md:hidden" aria-label="Mở menu" onClick={() => setMobile(true)}>
            <Menu size={20} />
          </button>
          <span className="truncate text-sm font-semibold">Finanion</span>
          {localMode && <span className="badge">Local</span>}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="btn hidden !py-1.5 text-xs text-muted sm:inline-flex"
              aria-label="Mở tìm kiếm nhanh"
              title={`Tìm kiếm nhanh (${searchHint})`}
            >
              <Search size={14} />
              <span>Tìm kiếm nhanh...</span>
              <kbd className="rounded border border-line bg-soft px-1.5 py-0.5 font-mono text-[10px] text-ink" suppressHydrationWarning>
                {searchHint}
              </kbd>
            </button>
            <div className="relative">
              <button
                type="button"
                className="dropdown-trigger inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium"
                onClick={() => setQuick(!quick)}
                aria-expanded={quick}
              >
                <Plus size={15} />
                <span className="hidden sm:inline">Tạo nhanh</span>
                <ChevronDown size={14} className={`transition-transform duration-150 ${quick ? 'rotate-180' : ''}`} />
              </button>
              {quick && (
                <div className="dropdown-menu absolute right-0 top-11 z-40 w-56 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => void handleCreatePage()}
                    className="dropdown-item flex w-full items-center justify-between px-4 py-2.5 text-left text-sm"
                  >
                    <span>Trang mới</span>
                    <kbd className="font-mono text-[11px] text-muted" suppressHydrationWarning>
                      {newPageHint}
                    </kbd>
                  </button>
                  {[
                    ['/app/finance/transactions?new=1', 'Giao dịch'],
                    ['/app/projects?new=1', 'Dự án'],
                    ['/app/tasks?new=1', 'Công việc'],
                  ].map(([href, itemLabel]) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setQuick(false)}
                      className="dropdown-item block px-4 py-2.5 text-sm"
                    >
                      {itemLabel}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn !p-2"
              onClick={toggleTheme}
              aria-label="Đổi giao diện"
              title={`Đổi giao diện (${themeHint})`}
            >
              {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>
        {localMode && (
          <p className="border-b border-line bg-soft px-4 py-2 text-xs text-muted md:px-8">
            Dữ liệu đang lưu trên máy này và chưa đồng bộ với Supabase.
          </p>
        )}
        <main className="mx-auto max-w-[1440px] px-4 py-7 md:px-8">{children}</main>
      </div>
      {searchOpen && <QuickSearchModal open onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
