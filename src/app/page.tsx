'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Book } from '@/types/book';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBooks } from '@/lib/storage';

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    // Using a timeout or similar to move setState out of the synchronous render path
    // if Next.js 16/React 19 linting is extremely strict about it.
    const timer = setTimeout(() => {
      setBooks(getBooks());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="font-display min-h-screen pb-24">
      <Header title="내 서재" transparent />

      <main className="mt-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">내 도서</h2>
          <div className="flex gap-2 text-primary">
            <span className="material-symbols-outlined">filter_list</span>
            <span className="material-symbols-outlined">grid_view</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {books.map((book) => (
            <Link key={book.id} href={`/book/${book.id}`} className="flex flex-col gap-2 group">
              <div
                className="relative w-full aspect-[3/4] bg-center bg-no-repeat bg-cover rounded-xl shadow-sm border border-primary/5 transition-transform group-active:scale-95"
                style={{ backgroundImage: `url("${book.coverImage}")` }}
              >
                {book.readingStatus === 'FINISHED' && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                    FINISHED
                  </div>
                )}
              </div>

              <div className="mt-1">
                <p className="text-sm font-bold truncate text-slate-900">{book.title}</p>
                <p className="text-xs text-slate-500 truncate">{book.author}</p>

                {book.readingStatus === 'READING' ? (
                  book.progress && book.progress > 0 ? (
                    <div className="flex items-center gap-1 mt-2">
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
                  <div className="flex items-center mt-1 text-primary">
                    <span className="material-symbols-outlined text-[10px] fill-1">star</span>
                    <span className="text-[10px] font-bold ml-0.5">{book.rating?.toFixed(1) || '0.0'}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>

      <Link
        href="/add"
        className="fixed bottom-24 right-6 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-transform z-20"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </Link>

      <BottomNav activeTab="home" />

      <style jsx global>{`
        .fill-1 {
          font-variation-settings: 'FILL' 1;
        }
      `}</style>
    </div>
  );
}
