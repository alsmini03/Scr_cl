'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Book } from '@/types/book';
import { cn } from '@/lib/utils';

interface BookGridProps {
  books: Book[];
}

type ViewMode = 'grid' | 'list';
type GridCols = 2 | 4 | 6;

export default function BookGrid({ books }: BookGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gridCols, setGridCols] = useState<GridCols>(2);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">내 도서</h2>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1 rounded-md transition-all",
                viewMode === 'grid' ? "bg-white text-primary shadow-sm" : "text-slate-400"
              )}
            >
              <span className="material-symbols-outlined text-xl block">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1 rounded-md transition-all",
                viewMode === 'list' ? "bg-white text-primary shadow-sm" : "text-slate-400"
              )}
            >
              <span className="material-symbols-outlined text-xl block">view_list</span>
            </button>
          </div>

          {/* Grid Column Selector (only visible in grid mode) */}
          {viewMode === 'grid' && (
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {[2, 4, 6].map((cols) => (
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
          "grid gap-4",
          gridCols === 2 && "grid-cols-2",
          gridCols === 4 && "grid-cols-4",
          gridCols === 6 && "grid-cols-6"
        )}>
          {books.map((book) => (
            <Link key={book.id} href={`/book/${book.id}`} className="flex flex-col gap-2 group">
              <div
                className="relative w-full aspect-[3/4] bg-center bg-no-repeat bg-cover rounded-xl shadow-sm border border-primary/5 transition-transform group-active:scale-95"
                style={{ backgroundImage: `url("${book.coverImage}")` }}
              >
                {book.readingStatus === 'FINISHED' && gridCols <= 4 && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-[8px] font-bold px-1 py-0.5 rounded shadow-sm">
                    DONE
                  </div>
                )}
              </div>

              {gridCols <= 4 && (
                <div className="mt-1">
                  <p className={cn(
                    "font-bold truncate text-slate-900",
                    gridCols === 2 ? "text-sm" : "text-[10px]"
                  )}>
                    {book.title}
                  </p>
                  {gridCols === 2 && (
                    <p className="text-xs text-slate-500 truncate">{book.author}</p>
                  )}

                  {book.readingStatus === 'READING' && book.progress !== undefined && book.progress > 0 && gridCols === 2 ? (
                    <div className="flex items-center gap-1 mt-2">
                      <div className="flex-1 h-1 bg-primary/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${book.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-primary">{book.progress}%</span>
                    </div>
                  ) : book.readingStatus === 'FINISHED' && gridCols === 2 ? (
                    <div className="flex items-center mt-1 text-primary">
                      <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-[10px] font-bold ml-0.5">{book.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {books.map((book) => (
            <Link key={book.id} href={`/book/${book.id}`} className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-2xl active:scale-[0.98] transition-all shadow-sm">
              <div
                className="w-16 h-20 bg-center bg-no-repeat bg-cover rounded-lg shrink-0 border border-slate-50"
                style={{ backgroundImage: `url("${book.coverImage}")` }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{book.title}</p>
                <p className="text-xs text-slate-500 truncate mb-2">{book.author}</p>

                {book.readingStatus === 'READING' ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-primary/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${book.progress || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] font-bold text-primary">{book.progress || 0}%</span>
                  </div>
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
          ))}
        </div>
      )}
    </div>
  );
}
