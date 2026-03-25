'use client';

import { cn } from '@/lib/utils';

interface ViewModeToggleProps {
  title: string;
  viewMode: 'my' | 'recommend';
  onViewModeChange: (mode: 'my' | 'recommend') => void;
  myLabel?: string;
  recommendLabel?: string;
}

export default function ViewModeToggle({
  title,
  viewMode,
  onViewModeChange,
  myLabel = "내 보관함",
  recommendLabel = "추천"
}: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-4">
      <h1 className="hidden sm:block text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-primary/10 relative min-w-[168px]">
        {/* Sliding background */}
        <div
          className={cn(
            "absolute inset-y-1 left-1 w-[calc(50%-4px)] bg-primary rounded-lg transition-all duration-200 shadow-md z-0",
            viewMode === 'recommend' ? "translate-x-full" : "translate-x-0"
          )}
        />
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewModeChange('my'); }}
          className={cn(
            "flex-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors text-center relative z-10",
            viewMode === 'my' ? "text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          )}
        >
          {myLabel}
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewModeChange('recommend'); }}
          className={cn(
            "flex-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors text-center relative z-10",
            viewMode === 'recommend' ? "text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          )}
        >
          {recommendLabel}
        </button>
      </div>
    </div>
  );
}
