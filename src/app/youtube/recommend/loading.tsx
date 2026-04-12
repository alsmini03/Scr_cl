'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { SkeletonVideoItem } from '@/components/YouTubeRecommendClient';

export default function YouTubeLoading() {
  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header title="유튜브" />
      <main className="mt-4 px-4">
        <div className="flex items-center gap-2 mb-6 -mx-4 px-4 py-2">
            <div className="h-9 w-20 bg-slate-200 dark:bg-black/30 rounded-full animate-skeleton" />
            <div className="h-9 w-20 bg-slate-200 dark:bg-black/30 rounded-full animate-skeleton" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <SkeletonVideoItem key={i} cols={2} />
          ))}
        </div>
      </main>
      <BottomNav activeTab="youtube" />
    </div>
  );
}
