'use client';

import Link from 'next/link';
import { Book } from '@/types/book';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

interface BookGridProps {
  books: Book[];
  viewMode: string; // '2' or '3' or '5' (based on design col counts)
  isSelectionMode?: boolean;
  selectedIds?: string[];
  onToggleSelection?: (id: string) => void;
  onLongPress?: (id: string) => void;
}

export default function BookGrid({
  books,
  viewMode = '2',
  isSelectionMode = false,
  selectedIds = [],
  onToggleSelection,
  onLongPress
}: BookGridProps) {
  const gridCols = parseInt(viewMode) || 2;
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
    <div className="space-y-6">
      <div className={cn(
        "grid gap-4",
        gridCols === 2 ? "grid-cols-2" : (gridCols === 3 ? "grid-cols-3" : "grid-cols-5")
      )}>
        {books.map((book) => {
          const isSelected = selectedIds.includes(book.id);
          return (
            <div key={book.id} className="relative flex flex-col gap-2 group">
              {isSelectionMode && (
                <button
                  onClick={() => onToggleSelection?.(book.id)}
                  className={cn(
                    "absolute top-2 left-2 z-10 size-5 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected
                      ? "bg-primary border-primary text-white"
                      : "bg-white/80 border-slate-300 text-transparent"
                  )}
                >
                  <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                </button>
              )}

              <Link
                href={isSelectionMode ? '#' : `/book/${book.id}`}
                onMouseDown={() => startPress(book.id)}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onTouchStart={() => startPress(book.id)}
                onTouchEnd={endPress}
                onClick={(e) => {
                  if (isSelectionMode) {
                    e.preventDefault();
                    onToggleSelection?.(book.id);
                  }
                }}
                className={cn(
                  "relative w-full aspect-[3/4] bg-center bg-no-repeat bg-cover rounded-xl border transition-all",
                  isSelected ? "border-primary ring-1 ring-primary" : "border-primary/5 shadow-sm",
                  !isSelectionMode && "active:scale-95 group-active:scale-95"
                )}
                style={{ backgroundImage: `url("${book.coverImage}")` }}
              >
                {book.readingStatus === 'FINISHED' && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                    FINISHED
                  </div>
                )}
              </Link>

              <div className="mt-1">
                <p className={cn(
                  "font-bold truncate text-slate-900 dark:text-slate-100",
                  gridCols === 2 ? "text-sm" : "text-xs"
                )}>
                  {book.title}
                </p>
                <p className="text-xs text-slate-500 truncate">{book.author}</p>

                {book.readingStatus === 'READING' && (book.progress || 0) > 0 ? (
                  <div className="flex items-center gap-1 mt-2">
                    <div className="flex-1 h-1 bg-primary/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${book.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] font-bold text-primary">{book.progress}%</span>
                  </div>
                ) : book.readingStatus === 'FINISHED' ? (
                  <div className="flex items-center mt-1 text-primary">
                    <span className="material-symbols-outlined text-[10px] fill-1">star</span>
                    <span className="text-[10px] font-bold ml-0.5">{book.rating?.toFixed(1) || '0.0'}</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
