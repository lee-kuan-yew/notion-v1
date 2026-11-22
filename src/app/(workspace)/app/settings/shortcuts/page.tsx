import Link from 'next/link';
import { PageHeader } from '@/components/shared/primitives';
import { ShortcutsReference } from '@/components/settings/shortcuts-reference';

export default function ShortcutsSettingsPage() {
  return (
    <>
      <div className="meta mb-2">
        <Link href="/app/settings" className="hover:underline">
          Cài đặt
        </Link>{' '}
        / Phím tắt
      </div>
      <PageHeader
        title="Phím tắt bàn phím"
        description="Tra cứu đầy đủ phím tắt toàn cục, trình soạn thảo BlockNote và bảng dữ liệu."
      />
      <ShortcutsReference />
    </>
  );
}
