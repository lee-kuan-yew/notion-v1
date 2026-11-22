import Link from 'next/link';
import { Keyboard } from 'lucide-react';
import { requireOwner } from '@/lib/auth/owner';
import { saveProfile } from '@/features/workspace/profile-action';
import { PageHeader, FormPanel, Field, Notice } from '@/components/shared/primitives';
import TimezoneSelect from '@/components/p-select-13';

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const q = await searchParams;
  const { supabase, user } = await requireOwner();
  const initialized = await supabase.rpc('initialize_owner');
  if (initialized.error) throw new Error(`Initialize owner: ${initialized.error.message}`);
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  return (
    <>
      <PageHeader title="Cài đặt" description="Thông tin cá nhân, cấu hình workspace và phím tắt." />
      <Notice error={q.error} saved={q.saved} />
      <FormPanel title="Hồ sơ">
        <form action={saveProfile} className="form-grid">
          <Field label="Email" name="email">
            <input className="input" id="email" value={user.email ?? ''} readOnly />
          </Field>
          <Field label="Tên hiển thị" name="display_name">
            <input className="input" id="display_name" name="display_name" maxLength={120} defaultValue={profile?.display_name ?? ''} />
          </Field>
          <Field label="Múi giờ" name="timezone">
            <TimezoneSelect id="timezone" name="timezone" defaultValue={profile?.timezone || 'Asia/Ho_Chi_Minh'} />
          </Field>
          <Field label="Tiền tệ" name="currency">
            <input className="input" id="currency" value="VND" readOnly />
          </Field>
          <div>
            <button className="btn btn-primary">Lưu cài đặt</button>
          </div>
        </form>
      </FormPanel>
      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <Keyboard size={20} className="mt-0.5 text-muted" />
          <div>
            <h2 className="font-semibold">Phím tắt bàn phím</h2>
            <p className="mt-1 text-sm text-muted">
              Xem danh sách đầy đủ phím tắt toàn cục (Quick Search, Trang mới, Đổi giao diện), trình soạn thảo BlockNote và điều hướng bảng theo macOS hoặc Windows/Linux.
            </p>
          </div>
        </div>
        <Link href="/app/settings/shortcuts" className="btn">
          Mở trang tham khảo phím tắt
        </Link>
      </section>
    </>
  );
}
