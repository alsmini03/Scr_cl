'use client';

import { cn } from '@/lib/utils';

interface ViewModeToggleProps {
  title: string;
  viewMode: 'my' | 'recommend';
  onViewModeChange: (mode: 'my' | 'recommend') => void;
}

export default function ViewModeToggle({ title, viewMode, onViewModeChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <h1 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100 truncate">
        {title}
      </h1>
      <div className="flex flex-col gap-0.5 p-0.5 bg-slate-200 dark:bg-slate-800 rounded-md">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewModeChange('my'); }}
          className={cn(
            "px-2 py-0.5 rounded text-[8px] font-bold transition-all text-center leading-tight min-w-[50px]",
            viewMode === 'my' ? "bg-white dark:bg-slate-700 text-primary shadow-xs" : "text-slate-500 dark:text-slate-400"
          )}
        >
          내 보관함
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewModeChange('recommend'); }}
          className={cn(
            "px-2 py-0.5 rounded text-[8px] font-bold transition-all text-center leading-tight min-w-[50px]",
            viewMode === 'recommend' ? "bg-white dark:bg-slate-700 text-primary shadow-xs" : "text-slate-500 dark:text-slate-400"
          )}
        >
          추천
        </button>
      </div>
    </div>
  );
}
