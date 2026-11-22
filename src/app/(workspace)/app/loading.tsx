import Ribbon from '@/components/ui/ribbon';

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-ink dark:text-white" role="status" aria-label="Đang tải">
      <Ribbon size={48} />
    </div>
  );
}
