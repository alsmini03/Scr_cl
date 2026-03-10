'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Book } from '@/types/book';
import { cn } from '@/lib/utils';

interface BookGridProps {
  books: Book[];
  isSelectionMode?: boolean;
  selectedIds?: string[];
  onToggleSelection?: (id: string) => void;
}

type ViewMode = 'grid' | 'list';
type GridCols = 3 | 5;

export default function BookGrid({
  books,
  viewMode = 'grid',
  isSelectionMode = false,
  selectedIds = [],
  onToggleSelection
}: BookGridProps & { viewMode?: string }) {
  const [gridCols, setGridCols] = useState<GridCols>(3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">내 도서</h2>
        <div className="flex items-center gap-3">
          {/* Grid Column Selector (only visible in grid mode) */}
          {viewMode === 'grid' && (
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {[3, 5].map((cols) => (
                <button
                  key={cols}
                  onClick={() => setGridCols(cols as GridCols)}
                  className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                    gridCols === cols ? "bg-white text-primary shadow-sm" : "text-slate-400"
                  )}
                >
                  {cols}열
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className={cn(
          "grid gap-x-3 gap-y-6",
          gridCols === 3 ? "grid-cols-3" : "grid-cols-5"
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
                    <div className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[7px] font-bold px-1 py-0.5 rounded shadow-sm">
                      DONE
                    </div>
                  )}
                </Link>

                <div className="mt-0.5 px-0.5">
                <p className={cn(
                  "font-bold truncate text-slate-900 leading-tight",
                  gridCols === 3 ? "text-xs" : "text-[9px]"
                )}>
                  {book.title}
                </p>
                {gridCols === 3 && (
                  <>
                    <p className="text-[10px] text-slate-500 truncate mb-1">{book.author}</p>
                    {book.readingStatus === 'READING' && book.progress !== undefined && book.progress > 0 ? (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex-1 h-0.5 bg-primary/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${book.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[8px] font-bold text-primary">{book.progress}%</span>
                      </div>
                    ) : book.readingStatus === 'FINISHED' ? (
                      <div className="flex items-center mt-0.5 text-primary">
                        <span className="material-symbols-outlined text-[8px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="text-[8px] font-bold ml-0.5">{book.rating?.toFixed(1) || '0.0'}</span>
                      </div>
                    ) : null}
                  </>
                )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {books.map((book) => {
            const isSelected = selectedIds.includes(book.id);
            return (
              <div key={book.id} className="relative flex items-center gap-4">
                {isSelectionMode && (
                  <button
                    onClick={() => onToggleSelection?.(book.id)}
                    className={cn(
                      "size-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                      isSelected
                        ? "bg-primary border-primary text-white"
                        : "bg-white border-slate-300 text-transparent"
                    )}
                  >
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </button>
                )}
                <Link
                  href={isSelectionMode ? '#' : `/book/${book.id}`}
                  onClick={(e) => {
                    if (isSelectionMode) {
                      e.preventDefault();
                      onToggleSelection?.(book.id);
                    }
                  }}
                  className={cn(
                    "flex-1 flex items-center gap-4 p-3 bg-white border rounded-2xl transition-all",
                    isSelected ? "border-primary ring-1 ring-primary" : "border-slate-100 shadow-sm",
                    !isSelectionMode && "active:scale-[0.98]"
                  )}
                >
                  <div
                    className="w-16 h-20 bg-center bg-no-repeat bg-cover rounded-lg shrink-0 border border-slate-50"
                    style={{ backgroundImage: `url("${book.coverImage}")` }}
                  />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{book.title}</p>
                <p className="text-xs text-slate-500 truncate mb-1">{book.author}</p>
                <p className="text-[10px] text-slate-400 truncate mb-2">{book.publishDate} · {book.price}</p>

                {book.readingStatus === 'READING' ? (
                  book.progress !== undefined && book.progress > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-primary/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${book.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-primary">{book.progress}%</span>
                    </div>
                  ) : null
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center text-primary">
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-xs font-bold ml-0.5">{book.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-green-100 text-green-600 text-[9px] font-bold rounded">완독</span>
                  </div>
                )}
              </div>
                  <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
