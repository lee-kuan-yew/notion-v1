'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { ReportChartsProps } from './report-charts';

const ReportCharts = dynamic(
  () => import('./report-charts').then(module => module.ReportCharts),
  { loading: () => <ChartPlaceholder /> }
);

function ChartPlaceholder() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-[310px]" />
      ))}
    </div>
  );
}

export function DeferredReportCharts(props: ReportChartsProps) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef}>{visible ? <ReportCharts {...props} /> : <ChartPlaceholder />}</div>;
}
