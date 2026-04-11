'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState, memo } from 'react';
import { cn, formatDateToYMD } from '@/lib/utils';
import Link from 'next/link';

export default function SavedClient({
  session,
  initialItems
}: {
  session: any;
  initialItems: any[];
}) {
  const [items] = useState<any[]>(initialItems);

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header title="저장된 항목" />

      <main className="mt-4 px-4">
        {items.length === 0 ? (
          <div className="py-20 text-center text-slate-400">저장된 항목이 없습니다.</div>
        ) : (
          <div className="space-y-3 pb-20">
            {items.map((item) => (
              <SavedItem key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </main>

      <BottomNav activeTab="saved" />
    </div>
  );
}

const SavedItem = memo(({ item }: { item: any }) => {
  let href = '';
  let icon = '';
  let iconColor = '';
  let typeLabel = '';

  if (item.type === 'youtube') {
    href = `/youtube/${item.id}`;
    icon = 'video_library';
    iconColor = 'text-red-500 bg-red-50 dark:bg-red-500/10';
    typeLabel = 'YouTube';
  } else if (item.type === 'blog') {
    href = `/blog/${item.id}`;
    icon = 'rss_feed';
    iconColor = 'text-green-500 bg-green-50 dark:bg-green-500/10';
    typeLabel = '블로그';
  } else if (item.type === 'report') {
    href = `/report?id=${item.id}`;
    icon = 'description';
    iconColor = 'text-blue-500 bg-blue-50 dark:bg-blue-500/10';
    typeLabel = '리포트';
  }

  return (
    <div className="relative animate-fade-in-up">
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 p-3 shadow-sm active:scale-[0.98] transition-all"
        )}
      >
        {item.type === 'youtube' && item.thumbnail ? (
          <div className="relative shrink-0 w-24 aspect-video rounded-lg overflow-hidden border border-slate-100 dark:border-primary/5">
            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] font-bold px-1 rounded">
                {item.duration}
            </div>
          </div>
        ) : (
          <div className={cn("size-12 shrink-0 rounded-xl flex items-center justify-center", iconColor)}>
            <span className="material-symbols-outlined">{icon}</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase",
                item.type === 'youtube' ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                item.type === 'blog' ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            )}>
                {typeLabel}
            </span>
            <span className="text-[10px] text-slate-400">{formatDateToYMD(item.added_at)}</span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-1 leading-tight">
            {item.title}
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {item.author || item.institution || ''}
          </p>
        </div>

        <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-sm">chevron_right</span>
      </Link>
    </div>
  );
});
