import Link from 'next/link';
import { loadProjectsWorkspace } from '@/features/workspace/queries';
import { loadDatabase } from '@/features/database/queries';
import { DatabaseView } from '@/features/database/components/database-view';
import { archiveProject } from '@/features/workspace/actions';
import { ProjectForm } from '@/features/projects/components/forms';
import { money, cents, projectProgress } from '@/lib/finance';
import { dateVN, label } from '@/components/shared/format';
import { PageHeader, Notice, Empty, Progress } from '@/components/shared/primitives';
import { PriorityBadge } from '@/components/shared/priority';
import { DeleteForm } from '@/components/shared/delete-form';
import { SelectDropdown } from '@/components/ui/dropdown';

export default async function Projects({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string; mode?: string; error?: string; saved?: string; status?: string }>;
}) {
  const q = await searchParams;
  const isDatabase = q.mode === 'database';
  const [d, dbData] = await Promise.all([
    loadProjectsWorkspace(),
    isDatabase ? loadDatabase('projects') : Promise.resolve(null),
  ]);
  const edit = d.projects.find(p => p.id === q.edit);
  const spending = new Map(d.spending.map(p => [p.project_id, p.spent]));
  const projects = q.status ? d.projects.filter(p => p.status === q.status) : d.projects;

  return (
    <>
      <PageHeader
        title="Dự án"
        description="Kế hoạch, tiến độ và chi phí ở cùng một nơi."
        createHref="/app/projects?new=1"
        createLabel="Dự án mới"
      />
      <Notice error={q.error} saved={q.saved} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/app/projects" className={`btn !py-1.5 text-xs ${!isDatabase ? 'btn-primary' : ''}`}>
          Thẻ dự án
        </Link>
        <Link href="/app/projects?mode=database" className={`btn !py-1.5 text-xs ${isDatabase ? 'btn-primary' : ''}`}>
          Bảng dữ liệu (Bảng · Board · Lịch)
        </Link>
        <Link href="/app/database/projects" className="ml-auto text-xs text-muted underline hover:text-ink">
          Mở toàn màn hình (/app/database/projects)
        </Link>
      </div>
      {(q.new || edit) && <ProjectForm project={edit} />}
      {isDatabase && dbData ? (
        <DatabaseView data={dbData} embedded />
      ) : (
        <>
          <form action="/app/projects" className="mb-5 flex items-center gap-2">
            <SelectDropdown
              name="status"
              aria-label="Lọc trạng thái dự án"
              className="max-w-48"
              defaultValue={q.status ?? ''}
              options={[
                { value: '', label: 'Mọi trạng thái' },
                ...['idea', 'planning', 'active', 'on_hold', 'completed', 'archived'].map(s => ({ value: s, label: label(s) })),
              ]}
            />
            <button className="btn">Lọc</button>
          </form>
          {projects.length === 0 ? (
            <Empty title="Chưa có dự án" description="Tạo dự án để quản lý công việc và ngân sách." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map(p => {
                const spent = cents(spending.get(p.id) ?? '0');
                const budget = p.budget_amount === null ? null : cents(p.budget_amount);
                const progress = projectProgress(d.tasks.filter(t => t.project_id === p.id));
                return (
                  <div key={p.id} className="card p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="mb-3 inline-block size-3 rounded-full" style={{ background: p.color }} />
                        <Link href={`/app/projects/${p.id}`} className="block truncate text-lg font-semibold hover:underline">
                          {p.name}
                        </Link>
                      </div>
                      <span className="badge">{label(p.status)}</span>
                    </div>
                    <p className="meta mt-2 line-clamp-2 min-h-8">{p.description || 'Chưa có mô tả'}</p>
                    <div className="mt-5 flex justify-between text-sm">
                      <span className="text-muted">Tiến độ</span>
                      <strong>{progress}%</strong>
                    </div>
                    <div className="mt-2">
                      <Progress percent={progress} />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
                      <div>
                        <p className="meta">Đã chi</p>
                        <p className="font-semibold">{money(spent)}</p>
                      </div>
                      <div>
                        <p className="meta">Còn lại</p>
                        <p className="font-semibold">{budget === null ? '—' : money(budget - spent)}</p>
                      </div>
                      <div>
                        <p className="meta">Hạn chót</p>
                        <p>{dateVN(p.due_date)}</p>
                      </div>
                      <div>
                        <p className="meta">Ưu tiên</p>
                        <div className="mt-1">
                          <PriorityBadge priority={p.priority} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link className="btn !px-2 !py-1 text-xs" href={`/app/projects/${p.id}`}>
                        Mở
                      </Link>
                      <Link className="btn !px-2 !py-1 text-xs" href={`/app/database/projects/${p.id}`}>
                        Ghi chú
                      </Link>
                      <Link className="btn !px-2 !py-1 text-xs" href={`?edit=${p.id}`}>
                        Sửa
                      </Link>
                      {p.status !== 'archived' && (
                        <form action={archiveProject}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="btn !px-2 !py-1 text-xs">Lưu trữ</button>
                        </form>
                      )}
                      <DeleteForm table="projects" id={p.id} returnTo="/app/projects" />
                    </div>
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
