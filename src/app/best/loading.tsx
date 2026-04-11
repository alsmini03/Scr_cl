'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { SkeletonBestItem } from '@/components/BestClient';

export default function BestLoading() {
  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header title="Yes24" />
      <main className="mt-4 px-4">
        <div className="flex items-center gap-2 mb-6 -mx-4 px-4 py-2 overflow-x-hidden">
            <div className="h-9 w-20 bg-slate-200 dark:bg-black/30 rounded-full animate-skeleton shrink-0" />
            <div className="h-9 w-20 bg-slate-200 dark:bg-black/30 rounded-full animate-skeleton shrink-0" />
            <div className="h-9 w-20 bg-slate-200 dark:bg-black/30 rounded-full animate-skeleton shrink-0" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <SkeletonBestItem key={i} />
          ))}
        </div>
      </main>
      <BottomNav activeTab="yes24" />
    </div>
  );
}
