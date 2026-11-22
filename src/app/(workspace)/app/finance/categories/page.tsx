import Link from 'next/link';
import { loadWorkspace } from '@/features/workspace/queries';
import { loadDatabase } from '@/features/database/queries';
import { DatabaseView } from '@/features/database/components/database-view';
import { saveCategory, archiveRecord } from '@/features/workspace/actions';
import { label } from '@/components/shared/format';
import { CategoryIcon, iconChoices } from '@/features/finance/components/category-icon';
import { PageHeader, Notice, FormPanel, Field, Empty } from '@/components/shared/primitives';
import { DeleteForm } from '@/components/shared/delete-form';
import { SelectDropdown } from '@/components/ui/dropdown';

export default async function Categories({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string; mode?: string; error?: string; saved?: string }>;
}) {
  const q = await searchParams;
  const d = await loadWorkspace();
  const edit = d.categories.find(c => c.id === q.edit);
  const show = !!q.new || !!edit;
  const names = new Map(d.categories.map(c => [c.id, c.name]));
  const isDatabase = q.mode === 'database';
  const dbData = isDatabase ? await loadDatabase('categories') : null;

  return (
    <>
      <PageHeader
        title="Danh mục"
        description="Phân loại thu nhập và chi tiêu theo cấu trúc cha con."
        createHref="/app/finance/categories?new=1"
        createLabel="Thêm danh mục"
      />
      <Notice error={q.error} saved={q.saved} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/app/finance/categories" className={`btn !py-1.5 text-xs ${!isDatabase ? 'btn-primary' : ''}`}>
          Danh sách
        </Link>
        <Link href="/app/finance/categories?mode=database" className={`btn !py-1.5 text-xs ${isDatabase ? 'btn-primary' : ''}`}>
          Bảng dữ liệu (Notion)
        </Link>
        <Link href="/app/database/categories" className="ml-auto text-xs text-muted underline hover:text-ink">
          Mở toàn màn hình (/app/database/categories)
        </Link>
      </div>
      {show && (
        <FormPanel title={edit ? 'Sửa danh mục' : 'Danh mục mới'}>
          <form action={saveCategory} className="form-grid">
            <input type="hidden" name="id" value={edit?.id ?? ''} />
            <Field label="Tên danh mục" name="name">
              <input className="input" name="name" id="name" required defaultValue={edit?.name} />
            </Field>
            <Field label="Loại" name="kind">
              <SelectDropdown
                id="kind"
                name="kind"
                defaultValue={edit?.kind ?? 'expense'}
                options={[
                  { value: 'expense', label: 'Chi tiêu' },
                  { value: 'income', label: 'Thu nhập' },
                ]}
              />
            </Field>
            <Field label="Danh mục cha" name="parent_id">
              <SelectDropdown
                id="parent_id"
                name="parent_id"
                defaultValue={edit?.parent_id ?? ''}
                options={[
                  { value: '', label: 'Không có' },
                  ...d.categories
                    .filter(c => c.id !== edit?.id)
                    .map(c => ({ value: c.id, label: `${c.name} · ${label(c.kind)}` })),
                ]}
              />
            </Field>
            <Field label="Biểu tượng (tên Lucide)" name="icon">
              <SelectDropdown
                id="icon"
                name="icon"
                defaultValue={edit?.icon ?? 'Tags'}
                options={[
                  ...(edit?.icon && !iconChoices.some(([value]) => value === edit.icon)
                    ? [{ value: edit.icon, label: edit.icon }]
                    : []),
                  ...iconChoices.map(([value, title]) => ({ value, label: title })),
                ]}
              />
            </Field>
            <input type="hidden" name="color" value={edit?.color ?? '#78716C'} />
            <div className="col-span-full flex items-end gap-2">
              <button className="btn btn-primary">Lưu</button>
              <Link className="btn" href="/app/finance/categories">
                Hủy
              </Link>
            </div>
          </form>
        </FormPanel>
      )}
      {isDatabase && dbData ? (
        <DatabaseView data={dbData} embedded />
      ) : d.categories.length === 0 ? (
        <Empty title="Chưa có danh mục" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Loại</th>
                <th>Danh mục cha</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {d.categories.map(c => (
                <tr key={c.id}>
                  <td>
                    <span className="mr-2 inline-flex align-middle">
                      <CategoryIcon name={c.icon} color={c.color} />
                    </span>
                    {c.name}
                  </td>
                  <td>{label(c.kind)}</td>
                  <td>{c.parent_id ? names.get(c.parent_id) : '—'}</td>
                  <td>
                    <span className="badge">{c.is_archived ? 'Đã lưu trữ' : 'Đang dùng'}</span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link className="btn !px-2 !py-1 text-xs" href={`?edit=${c.id}`}>
                        Sửa
                      </Link>
                      {!c.is_archived && (
                        <form action={archiveRecord}>
                          <input type="hidden" name="table" value="categories" />
                          <input type="hidden" name="id" value={c.id} />
                          <button className="btn !px-2 !py-1 text-xs">Lưu trữ</button>
                        </form>
                      )}
                      <DeleteForm table="categories" id={c.id} returnTo="/app/finance/categories" />
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
