'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { SkeletonReportItem } from '@/components/ReportClient';

export default function ReportLoading() {
  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 overflow-x-hidden">
      <Header title="리포트" />
      <main className="mt-4 px-4">
        <div className="flex flex-col gap-3 mb-6">
            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-skeleton w-full" />
            <div className="flex gap-2">
                <div className="h-9 w-16 bg-slate-200 dark:bg-black/30 rounded-full animate-skeleton" />
                <div className="h-9 w-16 bg-slate-200 dark:bg-black/30 rounded-full animate-skeleton" />
            </div>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <SkeletonReportItem key={i} />
          ))}
        </div>
      </main>
      <BottomNav activeTab="report" />
    </div>
  );
}
