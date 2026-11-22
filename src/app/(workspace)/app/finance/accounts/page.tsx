import Link from 'next/link';
import { loadWorkspace } from '@/features/workspace/queries';
import { loadDatabase } from '@/features/database/queries';
import { DatabaseView } from '@/features/database/components/database-view';
import { saveAccount, archiveRecord } from '@/features/workspace/actions';
import { money } from '@/lib/finance';
import { dateVN, label } from '@/components/shared/format';
import { PageHeader, Notice, FormPanel, Field, Empty } from '@/components/shared/primitives';
import { DeleteForm } from '@/components/shared/delete-form';
import { SelectDropdown } from '@/components/ui/dropdown';
import { MoneyInput } from '@/components/ui/money-input';

export default async function Accounts({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string; mode?: string; error?: string; saved?: string }>;
}) {
  const q = await searchParams;
  const d = await loadWorkspace();
  const edit = d.accounts.find(a => a.id === q.edit);
  const show = !!q.new || !!edit;
  const balances = new Map(d.balances.map(b => [b.account_id, b.balance]));
  const isDatabase = q.mode === 'database';
  const dbData = isDatabase ? await loadDatabase('accounts') : null;

  return (
    <>
      <PageHeader
        title="Tài khoản"
        description="Số dư được tính tự động từ giao dịch."
        createHref="/app/finance/accounts?new=1"
        createLabel="Thêm tài khoản"
      />
      <Notice error={q.error} saved={q.saved} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/app/finance/accounts" className={`btn !py-1.5 text-xs ${!isDatabase ? 'btn-primary' : ''}`}>
          Danh sách
        </Link>
        <Link href="/app/finance/accounts?mode=database" className={`btn !py-1.5 text-xs ${isDatabase ? 'btn-primary' : ''}`}>
          Bảng dữ liệu (Notion)
        </Link>
        <Link href="/app/database/accounts" className="ml-auto text-xs text-muted underline hover:text-ink">
          Mở toàn màn hình (/app/database/accounts)
        </Link>
      </div>
      {show && (
        <FormPanel title={edit ? 'Sửa tài khoản' : 'Tài khoản mới'}>
          <form action={saveAccount} className="form-grid">
            <input type="hidden" name="id" value={edit?.id ?? ''} />
            <Field label="Tên tài khoản" name="name">
              <input className="input" id="name" name="name" required defaultValue={edit?.name} />
            </Field>
            <Field label="Loại" name="account_type">
              <SelectDropdown
                id="account_type"
                name="account_type"
                defaultValue={edit?.account_type ?? 'bank'}
                options={['bank', 'cash', 'e_wallet', 'savings', 'other'].map(v => ({ value: v, label: label(v) }))}
              />
            </Field>
            <Field label="Số dư ban đầu" name="opening_balance">
              <MoneyInput
                key={edit?.id ?? 'new'}
                id="opening_balance"
                name="opening_balance"
                allowNegative
                required
                defaultValue={edit?.opening_balance ?? 0}
              />
            </Field>
            <Field label="Ngày số dư ban đầu" name="opening_balance_date">
              <input className="input" id="opening_balance_date" name="opening_balance_date" type="date" required defaultValue={edit?.opening_balance_date ?? d.today} />
            </Field>
            <input type="hidden" name="color" value={edit?.color ?? '#78716C'} />
            <div className="col-span-full flex items-end gap-2">
              <button className="btn btn-primary">Lưu</button>
              <Link className="btn" href="/app/finance/accounts">
                Hủy
              </Link>
            </div>
          </form>
        </FormPanel>
      )}
      {isDatabase && dbData ? (
        <DatabaseView data={dbData} embedded />
      ) : d.accounts.length === 0 ? (
        <Empty title="Chưa có tài khoản" description="Tạo tài khoản tiền mặt hoặc ngân hàng để bắt đầu ghi giao dịch." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Loại</th>
                <th>Số dư</th>
                <th>Ngày mở</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {d.accounts.map(a => (
                <tr key={a.id}>
                  <td>
                    <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: a.color }} />
                    {a.name}
                  </td>
                  <td>{label(a.account_type)}</td>
                  <td className="font-semibold">{money(balances.get(a.id) ?? '0')}</td>
                  <td>{dateVN(a.opening_balance_date)}</td>
                  <td>
                    <span className="badge">{a.is_archived ? 'Đã lưu trữ' : 'Đang dùng'}</span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link className="btn !px-2 !py-1 text-xs" href={`/app/finance/transactions?account=${a.id}`}>
                        Lịch sử
                      </Link>
                      <Link className="btn !px-2 !py-1 text-xs" href={`?edit=${a.id}`}>
                        Sửa
                      </Link>
                      {!a.is_archived && (
                        <form action={archiveRecord}>
                          <input type="hidden" name="table" value="accounts" />
                          <input type="hidden" name="id" value={a.id} />
                          <button className="btn !px-2 !py-1 text-xs">Lưu trữ</button>
                        </form>
                      )}
                      <DeleteForm table="accounts" id={a.id} returnTo="/app/finance/accounts" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
