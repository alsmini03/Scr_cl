'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

interface YoutubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  published_at: string;
}

interface YoutubeGridProps {
  videos: YoutubeVideo[];
  viewMode: string; // '1' or '2'
  isSelectionMode?: boolean;
  selectedIds?: string[];
  onToggleSelection?: (id: string) => void;
  onLongPress?: (id: string) => void;
}

export default function YoutubeGrid({
  videos,
  viewMode = '1',
  isSelectionMode = false,
  selectedIds = [],
  onToggleSelection,
  onLongPress
}: YoutubeGridProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startPress = (id: string) => {
    timerRef.current = setTimeout(() => {
      onLongPress?.(id);
    }, 500);
  };

  const endPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className={cn(
      "grid gap-6",
      viewMode === '2' ? "grid-cols-2" : "grid-cols-1"
    )}>
      {videos.map((video) => {
        const isSelected = selectedIds.includes(video.id);

        return (
          <div key={video.id} className="relative group">
            {isSelectionMode && (
              <button
                onClick={() => onToggleSelection?.(video.id)}
                className={cn(
                  "absolute top-2 left-2 z-10 size-6 rounded-full border-2 flex items-center justify-center transition-all",
                  isSelected
                    ? "bg-primary border-primary text-white"
                    : "bg-white/80 border-slate-300 text-transparent"
                )}
              >
                <span className="material-symbols-outlined text-sm font-bold">check</span>
              </button>
            )}

            <Link
              href={isSelectionMode ? '#' : `/youtube/${video.id}`}
              onMouseDown={() => startPress(video.id)}
              onMouseUp={endPress}
              onMouseLeave={endPress}
              onTouchStart={() => startPress(video.id)}
              onTouchEnd={endPress}
              onClick={(e) => {
                if (isSelectionMode) {
                  e.preventDefault();
                  onToggleSelection?.(video.id);
                }
              }}
              className={cn(
                "flex bg-slate-50 dark:bg-slate-900/50 rounded-2xl overflow-hidden border transition-all",
                viewMode === '1' ? "flex-row items-center p-3 gap-3" : "flex-col",
                isSelected ? "border-primary ring-1 ring-primary" : "border-slate-100 dark:border-primary/10 shadow-sm",
                !isSelectionMode && "active:scale-[0.98]"
              )}
            >
              <div className={cn(
                "aspect-video relative overflow-hidden rounded-xl",
                viewMode === '1' ? "w-40 shrink-0" : "w-full"
              )}>
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                 <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                   {video.duration}
                 </div>
              </div>
              <div className={cn(
                "flex flex-col justify-between flex-1 min-w-0",
                viewMode === '1' ? "" : "p-4 min-h-[110px]"
              )}>
                <h3 className={cn(
                  "font-bold text-slate-900 dark:text-slate-100 leading-snug mb-1",
                  viewMode === '1' ? "text-sm line-clamp-3" : "text-[13px] line-clamp-2"
                )}>
                  {video.title}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{video.published_at}</p>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
