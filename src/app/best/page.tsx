'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface BestBook {
  title: string;
  author: string;
  publisher: string;
  coverImage: string;
  yes24Url: string;
}

export default function BestPage() {
  const [books, setBooks] = useState<BestBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchBest() {
      try {
        const res = await fetch('/api/best');
        const data = await res.json();
        if (Array.isArray(data)) {
          setBooks(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBest();
  }, []);

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header title="베스트셀러" transparent />

      <main className="mt-6 px-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Yes24 일별 베스트</h2>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-slate-500 font-medium">실시간 베스트를 읽어오는 중...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p>베스트셀러 정보를 불러올 수 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {books.map((book, idx) => (
              <a
                key={idx}
                href={book.yes24Url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-2xl active:scale-[0.98] transition-all shadow-sm"
              >
                <div className="relative shrink-0">
                  <div
                    className="w-16 h-22 bg-center bg-no-repeat bg-cover rounded-lg border border-slate-50"
                    style={{ backgroundImage: `url("${book.coverImage}")` }}
                  />
                  <div className="absolute -top-2 -left-2 size-6 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
                    {idx + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug mb-1">{book.title}</p>
                  <p className="text-xs text-slate-500 truncate">{book.author}</p>
                  <p className="text-[10px] text-slate-400 truncate">{book.publisher}</p>
                </div>
                <span className="material-symbols-outlined text-slate-300">open_in_new</span>
              </a>
            ))}
          </div>
        )}
      </main>

      <BottomNav activeTab="best" />
    </div>
  );
}
