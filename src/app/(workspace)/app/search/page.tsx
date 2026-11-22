import Link from 'next/link';
import { requireOwner } from '@/lib/auth/owner';
import { loadWorkspace } from '@/features/workspace/queries';
import { PageHeader, Empty } from '@/components/shared/primitives';
import { money } from '@/lib/finance';

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const [{ supabase }, d] = await Promise.all([requireOwner(), loadWorkspace()]);
  const pagesRes = await supabase.from('pages').select('id,title,updated_at').order('updated_at', { ascending: false });
  const allPages = pagesRes.error ? [] : pagesRes.data;
  const term = q.trim().toLocaleLowerCase('vi');
  const pages = term ? allPages.filter(p => p.title.toLocaleLowerCase('vi').includes(term)) : [];
  const projects = term ? d.projects.filter(p => `${p.name} ${p.description}`.toLocaleLowerCase('vi').includes(term)) : [];
  const tasks = term ? d.tasks.filter(t => `${t.title} ${t.description}`.toLocaleLowerCase('vi').includes(term)) : [];
  const transactions = term
    ? d.transactions.filter(t => `${t.description} ${t.payee ?? ''} ${t.notes}`.toLocaleLowerCase('vi').includes(term))
    : [];

  return (
    <>
      <PageHeader title="Tìm kiếm" description="Tìm trang, dự án, công việc và giao dịch." />
      <form action="/app/search" className="mb-6 flex gap-2">
        <input className="input max-w-xl" name="q" defaultValue={q} placeholder="Nhập từ khóa..." autoFocus />
        <button className="btn btn-primary">Tìm</button>
      </form>
      {!term ? (
        <Empty title="Nhập từ khóa để tìm kiếm" />
      ) : pages.length + projects.length + tasks.length + transactions.length === 0 ? (
        <Empty title="Không có kết quả" />
      ) : (
        <div className="grid gap-4">
          {pages.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-2 font-semibold">Trang ({pages.length})</h2>
              {pages.map(p => (
                <Link key={p.id} className="block border-t border-line py-3 hover:underline" href={`/app/pages/${p.id}`}>
                  {p.title}
                </Link>
              ))}
            </section>
          )}
          {projects.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-2 font-semibold">Dự án ({projects.length})</h2>
              {projects.map(p => (
                <Link key={p.id} className="block border-t border-line py-3 hover:underline" href={`/app/projects/${p.id}`}>
                  {p.name}
                </Link>
              ))}
            </section>
          )}
          {tasks.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-2 font-semibold">Công việc ({tasks.length})</h2>
              {tasks.map(t => (
                <Link key={t.id} className="block border-t border-line py-3 hover:underline" href={`/app/tasks?edit=${t.id}`}>
                  {t.title}
                </Link>
              ))}
            </section>
          )}
          {transactions.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-2 font-semibold">Giao dịch ({transactions.length})</h2>
              {transactions.map(t => (
                <Link
                  key={t.id}
                  className="flex justify-between border-t border-line py-3 hover:underline"
                  href={`/app/finance/transactions?edit=${t.id}`}
                >
                  <span>{t.description || t.payee || t.type}</span>
                  <span>{money(t.amount)}</span>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}
