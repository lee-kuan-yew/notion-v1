import Link from 'next/link';
import { loadTransactionsWorkspace } from '@/features/workspace/queries';
import { loadDatabase } from '@/features/database/queries';
import { DatabaseView } from '@/features/database/components/database-view';
import { filterTransactions, type TransactionFilters } from '@/features/finance/filters';
import { TransactionForm } from '@/features/finance/components/transaction-form';
import { TransactionTable } from '@/features/finance/components/transaction-table';
import { PageHeader, Notice, Empty } from '@/components/shared/primitives';
import { SelectDropdown } from '@/components/ui/dropdown';

type Query = TransactionFilters & { edit?: string; new?: string; page?: string; mode?: string; error?: string; saved?: string };

export default async function Transactions({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  const d = await loadTransactionsWorkspace();
  const edit = d.transactions.find(t => t.id === q.edit);
  const isDatabase = q.mode === 'database';
  const dbData = isDatabase ? await loadDatabase('transactions') : null;

  const rows = filterTransactions(d.transactions, q);
  const page = Math.max(1, Number.parseInt(q.page ?? '1') || 1);
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize);
  const params = new URLSearchParams();
  for (const key of ['q', 'type', 'account', 'category', 'project', 'from', 'to', 'sort'] as const) {
    if (q[key]) params.set(key, q[key]!);
  }
  const href = (p: number) => `?${new URLSearchParams([...params, ['page', String(p)]]).toString()}`;

  return (
    <>
      <PageHeader
        title="Giao dịch"
        description="Một sổ giao dịch cho thu, chi và chuyển tiền."
        createHref="/app/finance/transactions?new=1"
        createLabel="Giao dịch mới"
      />
      <Notice error={q.error} saved={q.saved} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/app/finance/transactions" className={`btn !py-1.5 text-xs ${!isDatabase ? 'btn-primary' : ''}`}>
          Sổ giao dịch
        </Link>
        <Link href="/app/finance/transactions?mode=database" className={`btn !py-1.5 text-xs ${isDatabase ? 'btn-primary' : ''}`}>
          Bảng dữ liệu (Notion)
        </Link>
        <Link href="/app/database/transactions" className="ml-auto text-xs text-muted underline hover:text-ink">
          Mở toàn màn hình (/app/database/transactions)
        </Link>
      </div>
      {(q.new || edit) && (
        <TransactionForm
          transaction={edit}
          accounts={d.accounts}
          categories={d.categories}
          projects={d.projects}
          today={d.today}
          defaultProjectId={q.project}
        />
      )}
      {isDatabase && dbData ? (
        <DatabaseView data={dbData} embedded />
      ) : (
        <>
          <form action="/app/finance/transactions" className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <input className="input" name="q" placeholder="Tìm mô tả, đối tác..." defaultValue={q.q} />
            <SelectDropdown
              name="type"
              aria-label="Lọc theo loại giao dịch"
              defaultValue={q.type ?? ''}
              options={[
                { value: '', label: 'Mọi loại' },
                { value: 'income', label: 'Thu' },
                { value: 'expense', label: 'Chi' },
                { value: 'transfer', label: 'Chuyển' },
              ]}
            />
            <SelectDropdown
              name="account"
              aria-label="Lọc theo tài khoản"
              defaultValue={q.account ?? ''}
              options={[{ value: '', label: 'Mọi tài khoản' }, ...d.accounts.map(a => ({ value: a.id, label: a.name }))]}
            />
            <SelectDropdown
              name="category"
              aria-label="Lọc theo danh mục"
              defaultValue={q.category ?? ''}
              options={[{ value: '', label: 'Mọi danh mục' }, ...d.categories.map(c => ({ value: c.id, label: c.name }))]}
            />
            <SelectDropdown
              name="project"
              aria-label="Lọc theo dự án"
              defaultValue={q.project ?? ''}
              options={[{ value: '', label: 'Mọi dự án' }, ...d.projects.map(p => ({ value: p.id, label: p.name }))]}
            />
            <input className="input" name="from" type="date" aria-label="Từ ngày" defaultValue={q.from} />
            <input className="input" name="to" type="date" aria-label="Đến ngày" defaultValue={q.to} />
            <SelectDropdown
              name="sort"
              aria-label="Sắp xếp giao dịch"
              defaultValue={q.sort ?? 'date_desc'}
              options={[
                { value: 'date_desc', label: 'Ngày mới nhất' },
                { value: 'date_asc', label: 'Ngày cũ nhất' },
                { value: 'amount_desc', label: 'Số tiền giảm dần' },
                { value: 'amount_asc', label: 'Số tiền tăng dần' },
                { value: 'description_asc', label: 'Mô tả A–Z' },
                { value: 'description_desc', label: 'Mô tả Z–A' },
              ]}
            />
            <div className="flex gap-2">
              <button className="btn btn-primary">Lọc</button>
              <Link className="btn" href="/app/finance/transactions">
                Xóa lọc
              </Link>
              <Link className="btn" href={`/api/transactions/export?${params.toString()}`}>
                Xuất CSV
              </Link>
            </div>
          </form>
          <p className="meta mb-3">{rows.length} giao dịch</p>
          {visible.length === 0 ? (
            <Empty title="Không có giao dịch" description="Thêm giao dịch hoặc thay đổi bộ lọc." />
          ) : (
            <TransactionTable
              rows={visible}
              accounts={Object.fromEntries(d.accounts.map(a => [a.id, a.name]))}
              categories={Object.fromEntries(d.categories.map(c => [c.id, c.name]))}
              projects={Object.fromEntries(d.projects.map(p => [p.id, p.name]))}
            />
          )}
          <div className="mt-4 flex items-center justify-end gap-3">
            <span className="meta">
              Trang {Math.min(page, pages)}/{pages}
            </span>
            {page > 1 && (
              <Link className="btn" href={href(page - 1)}>
                Trước
              </Link>
            )}
            {page < pages && (
              <Link className="btn" href={href(page + 1)}>
                Sau
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
}
