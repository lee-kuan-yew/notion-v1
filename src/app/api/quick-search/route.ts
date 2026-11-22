import { requireOwner } from '@/lib/auth/owner';
import { databaseConfig, databaseKeys } from '@/features/database/config';
import { money } from '@/lib/finance';
import { label } from '@/components/shared/format';

export type QuickSearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  group: 'Trang' | 'Bảng dữ liệu' | 'Dự án' | 'Công việc' | 'Giao dịch' | 'Điều hướng';
};

const navShortcuts: QuickSearchItem[] = [
  { id: 'nav-home', title: 'Tổng quan', subtitle: 'Bảng điều khiển chính', href: '/app', group: 'Điều hướng' },
  { id: 'nav-pages', title: 'Tất cả trang', subtitle: 'Ghi chú & tài liệu BlockNote', href: '/app/pages', group: 'Điều hướng' },
  { id: 'nav-finance', title: 'Tài chính', subtitle: 'Tổng quan thu chi & báo cáo', href: '/app/finance', group: 'Điều hướng' },
  { id: 'nav-projects', title: 'Dự án', subtitle: 'Quản lý dự án & tiến độ', href: '/app/projects', group: 'Điều hướng' },
  { id: 'nav-tasks', title: 'Công việc', subtitle: 'Danh sách & bảng công việc', href: '/app/tasks', group: 'Điều hướng' },
  { id: 'nav-shortcuts', title: 'Phím tắt (Settings)', subtitle: 'Tra cứu phím tắt toàn cục, editor và bảng', href: '/app/settings/shortcuts', group: 'Điều hướng' },
];

export async function GET(request: Request) {
  try {
    const { supabase } = await requireOwner();
    const { searchParams } = new URL(request.url);
    const term = (searchParams.get('q') ?? '').trim().toLocaleLowerCase('vi');
    const dbItems: QuickSearchItem[] = databaseKeys.map(key => ({
      id: `db-${key}`,
      title: `Bảng ${databaseConfig[key].title}`,
      subtitle: `/app/database/${key}`,
      href: `/app/database/${key}`,
      group: 'Bảng dữ liệu',
    }));

    if (!term) {
      return Response.json(
        { items: [...navShortcuts, ...dbItems].slice(0, 24) },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const [pagesResult, projectsResult, tasksResult, transactionsResult] = await Promise.all([
      supabase.from('pages').select('id,title,updated_at').order('updated_at', { ascending: false }),
      supabase.from('projects').select('id,name,status,priority').order('updated_at', { ascending: false }),
      supabase.from('tasks').select('id,title,status,priority').order('created_at', { ascending: false }),
      supabase.from('transactions').select('id,description,payee,type,transaction_date,amount').order('transaction_date', { ascending: false }),
    ]);

    const items: QuickSearchItem[] = [];

    const pages = pagesResult.error ? [] : pagesResult.data;
    const pageItems: QuickSearchItem[] = pages.map(page => ({
      id: `page-${page.id}`,
      title: page.title,
      subtitle: 'Trang tài liệu',
      href: `/app/pages/${page.id}`,
      group: 'Trang',
    }));

    const projectItems: QuickSearchItem[] = (projectsResult.data ?? []).map(p => ({
      id: `proj-${p.id}`,
      title: p.name,
      subtitle: `${label(p.status)} · ${label(p.priority)}`,
      href: `/app/database/projects/${p.id}`,
      group: 'Dự án',
    }));

    const taskItems: QuickSearchItem[] = (tasksResult.data ?? []).map(t => ({
      id: `task-${t.id}`,
      title: t.title,
      subtitle: `${label(t.status)} · ${label(t.priority)}`,
      href: `/app/database/tasks/${t.id}`,
      group: 'Công việc',
    }));

    const txItems: QuickSearchItem[] = (transactionsResult.data ?? []).slice(0, 80).map(t => ({
      id: `tx-${t.id}`,
      title: t.description || t.payee || label(t.type),
      subtitle: `${t.transaction_date} · ${money(t.amount)}`,
      href: `/app/database/transactions/${t.id}`,
      group: 'Giao dịch',
    }));

    const matches = (item: QuickSearchItem) =>
      !term || `${item.title} ${item.subtitle} ${item.group}`.toLocaleLowerCase('vi').includes(term);

    items.push(
      ...pageItems.filter(matches).slice(0, 6),
      ...dbItems.filter(matches).slice(0, 7),
      ...projectItems.filter(matches).slice(0, 6),
      ...taskItems.filter(matches).slice(0, 6),
      ...txItems.filter(matches).slice(0, 6),
      ...navShortcuts.filter(matches).slice(0, 6)
    );

    return Response.json({ items: items.slice(0, 24) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
