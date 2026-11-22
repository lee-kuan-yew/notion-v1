'use client';
import Link from 'next/link';
import type { Transaction } from '@/types/database';
import { money } from '@/lib/finance';
import { dateVN, label } from '@/components/shared/format';
import { ConfirmButton } from '@/components/shared/confirm-button';
import { deleteRecord } from '@/features/workspace/actions';

export function TransactionTable({
  rows,
  accounts,
  categories,
  projects,
}: {
  rows: Transaction[];
  accounts: Record<string, string>;
  categories: Record<string, string>;
  projects: Record<string, string>;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Giao dịch</th>
            <th>Tài khoản</th>
            <th>Danh mục / Dự án</th>
            <th>Số tiền</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id}>
              <td>{dateVN(t.transaction_date)}</td>
              <td>
                <span className="font-semibold">{t.description || label(t.type)}</span>
                <br />
                <span className="meta">{t.payee || label(t.type)}</span>
              </td>
              <td>
                {t.type === 'transfer'
                  ? `${accounts[t.from_account_id ?? ''] ?? '—'} → ${accounts[t.to_account_id ?? ''] ?? '—'}`
                  : accounts[t.account_id ?? ''] ?? '—'}
              </td>
              <td>
                {categories[t.category_id ?? ''] ?? '—'}
                {t.project_id && (
                  <>
                    <br />
                    <Link className="text-xs underline" href={`/app/projects/${t.project_id}`}>
                      {projects[t.project_id]}
                    </Link>
                  </>
                )}
              </td>
              <td>
                <span
                  className={`font-semibold ${
                    t.type === 'income' ? 'text-green-600' : t.type === 'expense' ? 'text-red-600' : ''
                  }`}
                >
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                  {money(t.amount)}
                </span>
              </td>
              <td>
                <div className="flex gap-2">
                  <Link className="btn !px-2 !py-1 text-xs" href={`?edit=${t.id}`}>
                    Sửa
                  </Link>
                  <form action={deleteRecord}>
                    <input type="hidden" name="table" value="transactions" />
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="return_to" value="/app/finance/transactions" />
                    <ConfirmButton>Xóa</ConfirmButton>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
