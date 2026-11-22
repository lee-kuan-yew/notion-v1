import Link from 'next/link';
import { loadBudgetsWorkspace } from '@/features/workspace/queries';
import { loadDatabase } from '@/features/database/queries';
import { DatabaseView } from '@/features/database/components/database-view';
import { saveBudget } from '@/features/workspace/actions';
import { cents, money } from '@/lib/finance';
import { PageHeader, Notice, FormPanel, Field, Empty, Progress } from '@/components/shared/primitives';
import { DeleteForm } from '@/components/shared/delete-form';
import { SelectDropdown } from '@/components/ui/dropdown';
import { MoneyInput } from '@/components/ui/money-input';

export default async function Budgets({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; edit?: string; new?: string; mode?: string; error?: string; saved?: string }>;
}) {
  const q = await searchParams;
  const d = await loadBudgetsWorkspace(q.month);
  const edit = d.budgets.find(b => b.id === q.edit);
  const show = !!q.new || !!edit;
  const actuals = new Map(d.actuals.map(a => [a.budget_id, a.spent]));
  const names = new Map(d.categories.map(c => [c.id, c.name]));
  const filtered = d.budgets.filter(b => b.month_start === d.month);
  const total = cents(d.budgetTotals.budget);
  const spent = cents(d.budgetTotals.spent);
  const isDatabase = q.mode === 'database';
  const dbData = isDatabase ? await loadDatabase('budgets') : null;

  return (
    <>
      <PageHeader
        title="Ngân sách"
        description="Hạn mức theo danh mục cho từng tháng."
        createHref={`/app/finance/budgets?month=${d.month.slice(0, 7)}&new=1`}
        createLabel="Thêm ngân sách"
      />
      <Notice error={q.error} saved={q.saved} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/app/finance/budgets?month=${d.month.slice(0, 7)}`} className={`btn !py-1.5 text-xs ${!isDatabase ? 'btn-primary' : ''}`}>
          Theo tháng
        </Link>
        <Link href="/app/finance/budgets?mode=database" className={`btn !py-1.5 text-xs ${isDatabase ? 'btn-primary' : ''}`}>
          Bảng dữ liệu (Notion)
        </Link>
        <Link href="/app/database/budgets" className="ml-auto text-xs text-muted underline hover:text-ink">
          Mở toàn màn hình (/app/database/budgets)
        </Link>
      </div>
      {show && (
        <FormPanel title={edit ? 'Sửa ngân sách' : 'Ngân sách mới'}>
          <form action={saveBudget} className="form-grid">
            <input type="hidden" name="id" value={edit?.id ?? ''} />
            <Field label="Danh mục chi" name="category_id">
              <SelectDropdown
                id="category_id"
                name="category_id"
                defaultValue={edit?.category_id ?? ''}
                required
                options={[
                  { value: '', label: 'Chọn danh mục' },
                  ...d.categories
                    .filter(c => c.kind === 'expense' && (!c.is_archived || c.id === edit?.category_id))
                    .map(c => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>
            <Field label="Ngày đầu tháng" name="month_start">
              <input className="input" id="month_start" name="month_start" type="date" required defaultValue={edit?.month_start ?? d.month} />
            </Field>
            <Field label="Số tiền" name="amount">
              <MoneyInput
                key={edit?.id ?? 'new'}
                id="amount"
                name="amount"
                placeholder="1,000,000"
                required
                defaultValue={edit?.amount}
              />
            </Field>
            <div className="flex items-end gap-2">
              <button className="btn btn-primary">Lưu</button>
              <Link className="btn" href="/app/finance/budgets">
                Hủy
              </Link>
            </div>
          </form>
        </FormPanel>
      )}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-muted">Ngân sách</p>
          <p className="mt-2 text-2xl font-semibold">{money(total)}</p>
        </div>
        <div className="card p-5">
          <p className="text-muted">Đã chi</p>
          <p className="mt-2 text-2xl font-semibold">{money(spent)}</p>
        </div>
        <div className="card p-5">
          <p className="text-muted">Còn lại</p>
          <p className="mt-2 text-2xl font-semibold">{money(total - spent)}</p>
        </div>
      </div>
      {isDatabase && dbData ? (
        <DatabaseView data={dbData} embedded />
      ) : (
        <>
          <form action="/app/finance/budgets" className="mb-5 flex items-end gap-2">
            <Field label="Tháng" name="month">
              <input className="input" id="month" name="month" type="month" defaultValue={d.month.slice(0, 7)} />
            </Field>
            <button className="btn">Xem</button>
          </form>
          {filtered.length === 0 ? (
            <Empty title="Chưa có ngân sách tháng này" description="Tạo hạn mức theo danh mục để theo dõi mức chi." />
          ) : (
            <div className="grid gap-3">
              {filtered.map(b => {
                const actual = cents(actuals.get(b.id) ?? '0');
                const budget = cents(b.amount);
                const percent = budget > 0n ? Number((actual * 100n) / budget) : 0;
                return (
                  <div className="card p-5" key={b.id}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{names.get(b.category_id) ?? 'Danh mục đã xóa'}</h3>
                        <p className="meta mt-1">
                          {money(actual)} / {money(budget)} · {percent}%
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link className="btn !px-2 !py-1 text-xs" href={`?month=${d.month.slice(0, 7)}&edit=${b.id}`}>
                          Sửa
                        </Link>
                        <DeleteForm table="budgets" id={b.id} returnTo={`/app/finance/budgets?month=${d.month.slice(0, 7)}`} />
                      </div>
                    </div>
                    <Progress percent={percent} />
                    <p className={`mt-2 text-xs ${percent > 100 ? 'text-red-600' : 'text-muted'}`}>
                      Còn lại {money(budget - actual)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
