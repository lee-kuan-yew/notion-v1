import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadProjectDetailWorkspace } from '@/features/workspace/queries';
import { loadDatabase } from '@/features/database/queries';
import { DatabaseView } from '@/features/database/components/database-view';
import { ProjectForm, MilestoneForm } from '@/features/projects/components/forms';
import { money, cents, projectProgress } from '@/lib/finance';
import { dateVN, label } from '@/components/shared/format';
import { PageHeader, Notice, Metric, Empty, Progress } from '@/components/shared/primitives';
import { PriorityBadge } from '@/components/shared/priority';
import { DeleteForm } from '@/components/shared/delete-form';

export default async function ProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; mode?: string; edit?: string; new?: string; error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const tab = ['overview', 'tasks', 'milestones', 'expenses'].includes(q.tab ?? '') ? q.tab : 'overview';
  const isDatabase = q.mode === 'database';
  const [d, dbTasks, dbMilestones] = await Promise.all([
    loadProjectDetailWorkspace(),
    tab === 'tasks' && isDatabase ? loadDatabase('tasks', { projectId: id }) : Promise.resolve(null),
    tab === 'milestones' && isDatabase ? loadDatabase('milestones', { projectId: id }) : Promise.resolve(null),
  ]);
  const project = d.projects.find(p => p.id === id);
  if (!project) notFound();
  const projectTasks = d.tasks.filter(t => t.project_id === id);
  const milestones = d.milestones.filter(m => m.project_id === id);
  const expenses = d.transactions.filter(t => t.project_id === id && t.type === 'expense');
  const spent = cents(d.spending.find(p => p.project_id === id)?.spent ?? '0');
  const budget = project.budget_amount === null ? null : cents(project.budget_amount);
  const progress = projectProgress(projectTasks);
  const accountNames = new Map(d.accounts.map(a => [a.id, a.name]));
  const categoryNames = new Map(d.categories.map(c => [c.id, c.name]));

  return (
    <>
      <div className="meta mb-2 flex items-center justify-between gap-2">
        <span>
          <Link href="/app/projects" className="hover:underline">
            Dự án
          </Link>{' '}
          / {project.name}
        </span>
        <Link href={`/app/database/projects/${id}`} className="underline hover:text-ink">
          Mở trang ghi chú & thuộc tính dự án ↗
        </Link>
      </div>
      <PageHeader
        title={project.name}
        description={project.description || 'Không có mô tả'}
        createHref={`/app/finance/transactions?new=1&project=${id}`}
        createLabel="Ghi chi phí"
      />
      <Notice error={q.error} saved={q.saved} />
      {q.edit === 'project' && <ProjectForm project={project} />}
      <div className="mb-6 flex gap-2 overflow-auto border-b border-line">
        {[
          ['overview', 'Tổng quan'],
          ['tasks', 'Công việc'],
          ['milestones', 'Cột mốc'],
          ['expenses', 'Chi phí'],
        ].map(([key, title]) => (
          <Link
            key={key}
            href={`?tab=${key}`}
            className={`whitespace-nowrap border-b-2 px-3 py-3 ${tab === key ? 'border-ink font-semibold' : 'border-transparent text-muted'}`}
          >
            {title}
          </Link>
        ))}
      </div>
      {tab === 'overview' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Trạng thái"
              value={label(project.status)}
              sub={
                <span className="inline-flex items-center gap-1.5">
                  <span>Ưu tiên:</span>
                  <PriorityBadge priority={project.priority} size="xs" />
                </span>
              }
            />
            <Metric
              label="Tiến độ"
              value={`${progress}%`}
              sub={`${projectTasks.filter(t => t.status === 'done').length}/${projectTasks.filter(t => t.status !== 'cancelled').length} công việc hoàn tất`}
            />
            <Metric label="Đã chi" value={money(spent)} sub={`${expenses.length} giao dịch`} />
            <Metric
              label="Ngân sách còn lại"
              value={budget === null ? 'Chưa đặt' : money(budget - spent)}
              sub={budget === null ? '' : `Ngân sách ${money(budget)}`}
            />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <div className="mb-4 flex justify-between">
                <h2 className="font-semibold">Tiến độ dự án</h2>
                <Link href="?edit=project" className="text-sm underline">
                  Sửa
                </Link>
              </div>
              <Progress percent={progress} />
              <div className="mt-5 flex justify-between border-t border-line pt-4">
                <span className="text-muted">Bắt đầu</span>
                <span>{dateVN(project.start_date)}</span>
              </div>
              <div className="mt-3 flex justify-between">
                <span className="text-muted">Hạn chót</span>
                <span>{dateVN(project.due_date)}</span>
              </div>
            </section>
            <section className="card p-5">
              <h2 className="mb-4 font-semibold">Sắp tới</h2>
              {[
                ...projectTasks
                  .filter(t => t.due_date && t.status !== 'done')
                  .map(t => ({ id: t.id, title: t.title, date: t.due_date!, kind: 'Công việc' })),
                ...milestones
                  .filter(m => m.due_date && m.status !== 'completed')
                  .map(m => ({ id: m.id, title: m.title, date: m.due_date!, kind: 'Cột mốc' })),
              ]
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 5)
                .map(item => (
                  <div key={item.id} className="flex justify-between border-t border-line py-2">
                    <span>
                      {item.title}
                      <span className="meta ml-2">{item.kind}</span>
                    </span>
                    <span className="text-muted">{dateVN(item.date)}</span>
                  </div>
                ))}
              {!projectTasks.some(t => t.due_date && t.status !== 'done') &&
                !milestones.some(m => m.due_date && m.status !== 'completed') && (
                  <p className="text-muted">Chưa có hạn chót sắp tới.</p>
                )}
            </section>
          </div>
        </>
      )}
      {tab === 'tasks' && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Link href="?tab=tasks" className={`btn !py-1.5 text-xs ${!isDatabase ? 'btn-primary' : ''}`}>
                Danh sách
              </Link>
              <Link href="?tab=tasks&mode=database" className={`btn !py-1.5 text-xs ${isDatabase ? 'btn-primary' : ''}`}>
                Bảng dữ liệu (Notion)
              </Link>
            </div>
            <Link className="btn btn-primary" href={`/app/tasks?new=1&project=${id}`}>
              Thêm công việc
            </Link>
          </div>
          {isDatabase && dbTasks ? (
            <DatabaseView data={dbTasks} embedded />
          ) : projectTasks.length === 0 ? (
            <Empty title="Chưa có công việc" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Công việc</th>
                    <th>Trạng thái</th>
                    <th>Ưu tiên</th>
                    <th>Hạn chót</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {projectTasks.map(t => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>
                        <span className="badge">{label(t.status)}</span>
                      </td>
                      <td>
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td>{dateVN(t.due_date)}</td>
                      <td>
                        <Link className="btn !px-2 !py-1 text-xs" href={`/app/tasks?edit=${t.id}`}>
                          Sửa
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {tab === 'milestones' && (
        <>
          {(q.new || (q.edit && q.edit !== 'project')) && (
            <MilestoneForm projectId={id} milestone={milestones.find(m => m.id === q.edit)} />
          )}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Link href="?tab=milestones" className={`btn !py-1.5 text-xs ${!isDatabase ? 'btn-primary' : ''}`}>
                Danh sách
              </Link>
              <Link href="?tab=milestones&mode=database" className={`btn !py-1.5 text-xs ${isDatabase ? 'btn-primary' : ''}`}>
                Bảng dữ liệu (Notion)
              </Link>
            </div>
            <Link className="btn btn-primary" href="?tab=milestones&new=1">
              Thêm cột mốc
            </Link>
          </div>
          {isDatabase && dbMilestones ? (
            <DatabaseView data={dbMilestones} embedded />
          ) : milestones.length === 0 ? (
            <Empty title="Chưa có cột mốc" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cột mốc</th>
                    <th>Hạn chót</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map(m => (
                    <tr key={m.id}>
                      <td>{m.title}</td>
                      <td>{dateVN(m.due_date)}</td>
                      <td>
                        <span className="badge">{label(m.status)}</span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Link className="btn !px-2 !py-1 text-xs" href={`?tab=milestones&edit=${m.id}`}>
                            Sửa
                          </Link>
                          <DeleteForm table="milestones" id={m.id} returnTo={`/app/projects/${id}?tab=milestones`} />
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
      {tab === 'expenses' && (
        <>
          {expenses.length === 0 ? (
            <Empty title="Chưa có chi phí" description="Gắn một giao dịch chi tiêu với dự án để theo dõi thực chi." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Mô tả</th>
                    <th>Danh mục</th>
                    <th>Tài khoản</th>
                    <th>Số tiền</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(t => (
                    <tr key={t.id}>
                      <td>{dateVN(t.transaction_date)}</td>
                      <td>{t.description || t.payee || 'Chi phí'}</td>
                      <td>{categoryNames.get(t.category_id ?? '')}</td>
                      <td>{accountNames.get(t.account_id ?? '')}</td>
                      <td className="font-semibold text-red-600">{money(t.amount)}</td>
                      <td>
                        <Link className="btn !px-2 !py-1 text-xs" href={`/app/finance/transactions?edit=${t.id}`}>
                          Sửa
                        </Link>
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
