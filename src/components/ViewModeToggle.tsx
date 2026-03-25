'use client';

import { cn } from '@/lib/utils';

interface ViewModeToggleProps {
  title: string;
  viewMode: 'my' | 'recommend';
  onViewModeChange: (mode: 'my' | 'recommend') => void;
}

export default function ViewModeToggle({ title, viewMode, onViewModeChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-4">
      <h1 className="hidden sm:block text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-primary/10">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewModeChange('my'); }}
          className={cn(
            "px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-center min-w-[80px]",
            viewMode === 'my' ? "bg-primary text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          )}
        >
          내 보관함
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewModeChange('recommend'); }}
          className={cn(
            "px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-center min-w-[80px]",
            viewMode === 'recommend' ? "bg-primary text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          )}
        >
          추천
        </button>
      </div>
    </div>
  );
}
