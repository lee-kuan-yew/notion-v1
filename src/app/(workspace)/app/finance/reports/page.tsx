import { loadReportWorkspace } from '@/features/workspace/queries';
import { reportData } from '@/features/finance/report-data';
import { DeferredReportCharts as ReportCharts } from '@/components/charts/deferred-report-charts';
import { PeriodFilter } from '@/components/shared/period-filter';
import { PageHeader,Metric } from '@/components/shared/primitives';
import { money,cents } from '@/lib/finance';
export default async function Reports({searchParams}:{searchParams:Promise<{period?:string;from?:string;to?:string}>}) {
 const q=await searchParams;const d=await loadReportWorkspace(q.period,q);const income=cents(d.totals.income),expense=cents(d.totals.expense);
 return <><PageHeader title="Báo cáo" description="Thu chi, dòng tiền, ngân sách và dự án từ dữ liệu thật."/><PeriodFilter action="/app/finance/reports" {...q}/><div className="mb-6 grid gap-4 sm:grid-cols-3"><Metric label="Thu trong kỳ" value={money(income)}/><Metric label="Chi trong kỳ" value={money(expense)}/><Metric label="Dòng tiền" value={money(income-expense)}/></div><ReportCharts {...reportData(d)}/></>;
}
