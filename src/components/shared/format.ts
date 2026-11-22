const LABELS: Record<string, string> = {
  income: 'Thu',
  expense: 'Chi',
  transfer: 'Chuyển',
  backlog: 'Backlog',
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  review: 'Duyệt',
  done: 'Hoàn tất',
  cancelled: 'Hủy',
  idea: 'Ý tưởng',
  planning: 'Lên kế hoạch',
  active: 'Đang chạy',
  on_hold: 'Tạm dừng',
  completed: 'Hoàn tất',
  archived: 'Lưu trữ',
  pending: 'Chờ',
  low: 'Thấp',
  medium: 'Vừa',
  high: 'Cao',
  urgent: 'Khẩn',
  bank: 'Ngân hàng',
  cash: 'Tiền mặt',
  e_wallet: 'Ví điện tử',
  savings: 'Tiết kiệm',
  other: 'Khác',
};

export function dateVN(value: string | null | undefined) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function label(value: string) {
  return LABELS[value] ?? value;
}
