import Link from 'next/link';
import type { Project, Task, Milestone } from '@/types/database';
import { saveProject, saveTask, saveMilestone } from '@/features/workspace/actions';
import { Field, FormPanel } from '@/components/shared/primitives';
import { label } from '@/components/shared/format';
import { SelectDropdown } from '@/components/ui/dropdown';
import { MoneyInput } from '@/components/ui/money-input';

export function ProjectForm({ project }: { project?: Project }) {
  return (
    <FormPanel title={project ? 'Sửa dự án' : 'Dự án mới'}>
      <form action={saveProject} className="form-grid">
        <input type="hidden" name="id" value={project?.id ?? ''} />
        <Field label="Tên dự án" name="name">
          <input className="input" name="name" id="name" required defaultValue={project?.name} />
        </Field>
        <Field label="Trạng thái" name="status">
          <SelectDropdown
            id="status"
            name="status"
            defaultValue={project?.status ?? 'planning'}
            options={['idea', 'planning', 'active', 'on_hold', 'completed', 'archived'].map(v => ({ value: v, label: label(v) }))}
          />
        </Field>
        <Field label="Ưu tiên" name="priority">
          <SelectDropdown
            id="priority"
            name="priority"
            defaultValue={project?.priority ?? 'medium'}
            options={['low', 'medium', 'high', 'urgent'].map(v => ({ value: v, label: label(v) }))}
          />
        </Field>
        <Field label="Ngân sách" name="budget_amount">
          <MoneyInput
            key={project?.id ?? 'new'}
            name="budget_amount"
            id="budget_amount"
            placeholder="10,000,000"
            defaultValue={project?.budget_amount ?? ''}
          />
        </Field>
        <Field label="Ngày bắt đầu" name="start_date">
          <input className="input" name="start_date" id="start_date" type="date" defaultValue={project?.start_date ?? ''} />
        </Field>
        <Field label="Hạn chót" name="due_date">
          <input className="input" name="due_date" id="due_date" type="date" defaultValue={project?.due_date ?? ''} />
        </Field>
        <input type="hidden" name="color" value={project?.color ?? '#78716C'} />
        <Field label="Mô tả" name="description" className="col-span-full">
          <textarea className="input" name="description" id="description" rows={3} defaultValue={project?.description} />
        </Field>
        <div className="col-span-full flex items-end gap-2">
          <button className="btn btn-primary">Lưu dự án</button>
          <Link href="/app/projects" className="btn">
            Hủy
          </Link>
        </div>
      </form>
    </FormPanel>
  );
}

export function TaskForm({ task, projects, defaultProjectId }: { task?: Task; projects: Project[]; defaultProjectId?: string }) {
  return (
    <FormPanel title={task ? 'Sửa công việc' : 'Công việc mới'}>
      <form action={saveTask} className="form-grid">
        <input type="hidden" name="id" value={task?.id ?? ''} />
        <Field label="Tên công việc" name="title">
          <input className="input" name="title" id="title" required defaultValue={task?.title} />
        </Field>
        <Field label="Dự án" name="project_id">
          <SelectDropdown
            id="project_id"
            name="project_id"
            defaultValue={task?.project_id ?? defaultProjectId ?? ''}
            options={[{ value: '', label: 'Không có dự án' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
          />
        </Field>
        <Field label="Trạng thái" name="status">
          <SelectDropdown
            id="status"
            name="status"
            defaultValue={task?.status ?? 'todo'}
            options={['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'].map(v => ({ value: v, label: label(v) }))}
          />
        </Field>
        <Field label="Ưu tiên" name="priority">
          <SelectDropdown
            id="priority"
            name="priority"
            defaultValue={task?.priority ?? 'medium'}
            options={['low', 'medium', 'high', 'urgent'].map(v => ({ value: v, label: label(v) }))}
          />
        </Field>
        <Field label="Bắt đầu" name="start_date">
          <input className="input" name="start_date" id="start_date" type="date" defaultValue={task?.start_date ?? ''} />
        </Field>
        <Field label="Hạn chót" name="due_date">
          <input className="input" name="due_date" id="due_date" type="date" defaultValue={task?.due_date ?? ''} />
        </Field>
        <Field label="Chi phí dự kiến" name="estimated_cost">
          <MoneyInput
            key={task?.id ?? 'new'}
            name="estimated_cost"
            id="estimated_cost"
            placeholder="500,000"
            defaultValue={task?.estimated_cost ?? ''}
          />
        </Field>
        <Field label="Vị trí" name="position">
          <input className="input" name="position" id="position" type="number" min="0" defaultValue={task?.position ?? 0} />
        </Field>
        <Field label="Mô tả" name="description" className="col-span-full">
          <textarea className="input" name="description" id="description" rows={3} defaultValue={task?.description} />
        </Field>
        <div className="col-span-full flex items-end gap-2">
          <button className="btn btn-primary">Lưu công việc</button>
          <Link href="/app/tasks" className="btn">
            Hủy
          </Link>
        </div>
      </form>
    </FormPanel>
  );
}

export function MilestoneForm({ projectId, milestone }: { projectId: string; milestone?: Milestone }) {
  return (
    <FormPanel title={milestone ? 'Sửa cột mốc' : 'Cột mốc mới'}>
      <form action={saveMilestone} className="form-grid">
        <input type="hidden" name="id" value={milestone?.id ?? ''} />
        <input type="hidden" name="project_id" value={projectId} />
        <Field label="Tên cột mốc" name="title">
          <input className="input" name="title" id="title" required defaultValue={milestone?.title} />
        </Field>
        <Field label="Ngày đến hạn" name="due_date">
          <input className="input" name="due_date" id="due_date" type="date" defaultValue={milestone?.due_date ?? ''} />
        </Field>
        <Field label="Trạng thái" name="status">
          <SelectDropdown
            id="status"
            name="status"
            defaultValue={milestone?.status ?? 'pending'}
            options={['pending', 'in_progress', 'completed'].map(v => ({ value: v, label: label(v) }))}
          />
        </Field>
        <Field label="Vị trí" name="position">
          <input className="input" name="position" id="position" type="number" min="0" defaultValue={milestone?.position ?? 0} />
        </Field>
        <Field label="Mô tả" name="description" className="col-span-full">
          <textarea className="input" name="description" id="description" rows={2} defaultValue={milestone?.description} />
        </Field>
        <div className="col-span-full flex items-end gap-2">
          <button className="btn btn-primary">Lưu cột mốc</button>
          <Link href={`/app/projects/${projectId}?tab=milestones`} className="btn">
            Hủy
          </Link>
        </div>
      </form>
    </FormPanel>
  );
}
