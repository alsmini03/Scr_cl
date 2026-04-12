'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { SkeletonSavedItem } from '@/components/SavedClient';

export default function SavedLoading() {
  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 overflow-x-hidden">
      <Header title="저장된 항목" />
      <main className="mt-4 px-4">
        <div className="flex items-center gap-2 mb-6 -mx-4 px-4 py-2">
            <div className="h-9 w-16 bg-slate-200 dark:bg-black/30 rounded-full animate-skeleton" />
            <div className="h-9 w-20 bg-slate-200 dark:bg-black/30 rounded-full animate-skeleton" />
            <div className="h-9 w-18 bg-slate-200 dark:bg-black/30 rounded-full animate-skeleton" />
        </div>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <SkeletonSavedItem key={i} />
          ))}
        </div>
      </main>
      <BottomNav activeTab="saved" />
    </div>
  );
}
