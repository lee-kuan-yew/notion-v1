import Link from 'next/link';
import { loadTasksWorkspace } from '@/features/workspace/queries';
import { loadDatabase } from '@/features/database/queries';
import { DatabaseView } from '@/features/database/components/database-view';
import { TaskForm } from '@/features/projects/components/forms';
import { TaskBoard } from '@/features/projects/components/task-board';
import { money, overdue } from '@/lib/finance';
import { dateVN, label } from '@/components/shared/format';
import { PageHeader, Notice, Empty } from '@/components/shared/primitives';
import { DeleteForm } from '@/components/shared/delete-form';
import { SelectDropdown } from '@/components/ui/dropdown';

export default async function Tasks({
  searchParams,
}: {
  searchParams: Promise<{
    new?: string;
    edit?: string;
    project?: string;
    status?: string;
    priority?: string;
    q?: string;
    due?: string;
    due_from?: string;
    due_to?: string;
    view?: string;
    error?: string;
    saved?: string;
  }>;
}) {
  const q = await searchParams;
  const d = await loadTasksWorkspace();
  const edit = d.tasks.find(t => t.id === q.edit);
  const projectNames = new Map(d.projects.map(p => [p.id, p.name]));
  const isDatabase = q.view === 'database';
  const dbData = isDatabase ? await loadDatabase('tasks') : null;
  const rows = d.tasks.filter(
    t =>
      (!q.q || `${t.title} ${t.description}`.toLocaleLowerCase('vi').includes(q.q.toLocaleLowerCase('vi'))) &&
      (!q.project || t.project_id === q.project) &&
      (!q.status || t.status === q.status) &&
      (!q.priority || t.priority === q.priority) &&
      (!q.due || q.due !== 'overdue' || overdue(t, d.today)) &&
      (!q.due_from || (!!t.due_date && t.due_date >= q.due_from)) &&
      (!q.due_to || (!!t.due_date && t.due_date <= q.due_to))
  );

  return (
    <>
      <PageHeader
        title="Công việc"
        description="Theo dõi mọi công việc, có hoặc không có dự án."
        createHref="/app/tasks?new=1"
        createLabel="Công việc mới"
      />
      <Notice error={q.error} saved={q.saved} />
      {(q.new || edit) && <TaskForm task={edit} projects={d.projects} defaultProjectId={q.project} />}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/app/tasks?view=table" className={`btn !py-1.5 text-xs ${q.view !== 'board' && !isDatabase ? 'btn-primary' : ''}`}>
          Bảng
        </Link>
        <Link href="/app/tasks?view=board" className={`btn !py-1.5 text-xs ${q.view === 'board' ? 'btn-primary' : ''}`}>
          Board
        </Link>
        <Link href="/app/tasks?view=database" className={`btn !py-1.5 text-xs ${isDatabase ? 'btn-primary' : ''}`}>
          Bảng dữ liệu (Bảng · Board · Lịch)
        </Link>
        <Link href="/app/database/tasks" className="ml-auto text-xs text-muted underline hover:text-ink">
          Mở toàn màn hình (/app/database/tasks)
        </Link>
      </div>
      {isDatabase && dbData ? (
        <DatabaseView data={dbData} embedded />
      ) : (
        <>
          <form action="/app/tasks" className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="view" value={q.view ?? 'table'} />
            <input className="input" name="q" placeholder="Tìm công việc..." defaultValue={q.q} />
            <SelectDropdown
              name="project"
              aria-label="Lọc theo dự án"
              defaultValue={q.project ?? ''}
              options={[{ value: '', label: 'Mọi dự án' }, ...d.projects.map(p => ({ value: p.id, label: p.name }))]}
            />
            <SelectDropdown
              name="status"
              aria-label="Lọc theo trạng thái"
              defaultValue={q.status ?? ''}
              options={[
                { value: '', label: 'Mọi trạng thái' },
                ...['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'].map(v => ({ value: v, label: label(v) })),
              ]}
            />
            <SelectDropdown
              name="priority"
              aria-label="Lọc theo ưu tiên"
              defaultValue={q.priority ?? ''}
              options={[
                { value: '', label: 'Mọi ưu tiên' },
                ...['low', 'medium', 'high', 'urgent'].map(v => ({ value: v, label: label(v) })),
              ]}
            />
            <SelectDropdown
              name="due"
              aria-label="Lọc theo hạn chót"
              defaultValue={q.due ?? ''}
              options={[
                { value: '', label: 'Mọi hạn chót' },
                { value: 'overdue', label: 'Quá hạn' },
              ]}
            />
            <input className="input" name="due_from" type="date" aria-label="Hạn từ" defaultValue={q.due_from} />
            <input className="input" name="due_to" type="date" aria-label="Hạn đến" defaultValue={q.due_to} />
            <div className="flex gap-2">
              <button className="btn btn-primary">Lọc</button>
              <Link href="/app/tasks" className="btn">
                Xóa lọc
              </Link>
            </div>
          </form>
          <p className="meta mb-3">{rows.length} công việc</p>
          {rows.length === 0 ? (
            <Empty title="Chưa có công việc phù hợp" />
          ) : q.view === 'board' ? (
            <TaskBoard tasks={rows} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Công việc</th>
                    <th>Dự án</th>
                    <th>Trạng thái</th>
                    <th>Ưu tiên</th>
                    <th>Bắt đầu</th>
                    <th>Hạn chót</th>
                    <th>Dự kiến</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(t => (
                    <tr key={t.id}>
                      <td className="font-medium">
                        <Link href={`/app/database/tasks/${t.id}`} className="hover:underline">
                          {t.title}
                        </Link>
                        {overdue(t, d.today) && <span className="ml-2 text-xs text-red-600">Quá hạn</span>}
                      </td>
                      <td>
                        {t.project_id ? (
                          <Link href={`/app/projects/${t.project_id}`} className="underline">
                            {projectNames.get(t.project_id)}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className="badge">{label(t.status)}</span>
                      </td>
                      <td>{label(t.priority)}</td>
                      <td>{dateVN(t.start_date)}</td>
                      <td>{dateVN(t.due_date)}</td>
                      <td>{t.estimated_cost === null ? '—' : money(t.estimated_cost)}</td>
                      <td>
                        <div className="flex gap-2">
                          <Link className="btn !px-2 !py-1 text-xs" href={`?edit=${t.id}`}>
                            Sửa
                          </Link>
                          <DeleteForm table="tasks" id={t.id} returnTo="/app/tasks" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
