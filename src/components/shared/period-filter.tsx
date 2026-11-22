'use client';

import { useState } from 'react';
import { SelectDropdown } from '@/components/ui/dropdown';

const periodOptions = [
  { value: 'month', label: 'Tháng này' },
  { value: 'last', label: 'Tháng trước' },
  { value: 'quarter', label: 'Quý này' },
  { value: 'year', label: 'Năm nay' },
  { value: 'custom', label: 'Tùy chọn' },
];

export function PeriodFilter({ action, period, from, to }: { action: string; period?: string; from?: string; to?: string }) {
  const [selectedPeriod, setSelectedPeriod] = useState(period ?? 'month');
  const isCustom = selectedPeriod === 'custom';

  return (
    <form action={action} className="mb-6 flex flex-wrap items-end gap-2">
      <div className="field min-w-44">
        <label htmlFor="period">Khoảng thời gian</label>
        <SelectDropdown
          id="period"
          name="period"
          value={selectedPeriod}
          onChange={setSelectedPeriod}
          options={periodOptions}
        />
      </div>
      {isCustom && (
        <>
          <div className="field min-w-44">
            <label htmlFor="from">Từ ngày</label>
            <input className="input" id="from" name="from" type="date" lang="vi-VN" defaultValue={from} required />
          </div>
          <div className="field min-w-44">
            <label htmlFor="to">Đến ngày</label>
            <input className="input" id="to" name="to" type="date" lang="vi-VN" defaultValue={to} required />
          </div>
        </>
      )}
      <button className="btn">Áp dụng</button>
    </form>
  );
}
