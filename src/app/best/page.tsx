'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { saveBook } from '@/lib/db';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

interface BestBook {
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  price: string;
  coverImage: string;
  yes24Url: string;
}

export default function BestPage() {
  const { data: session } = useSession();
  const [category, setCategory] = useState<'total' | 'economy' | 'essay'>('total');
  const [books, setBooks] = useState<BestBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingId, setAddingId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchBest() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/best?category=${category}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setBooks(data);
        } else {
          setBooks([]);
        }
      } catch (err) {
        console.error(err);
        setBooks([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBest();
  }, [category]);

  const handleAddBook = async (e: React.MouseEvent, book: BestBook, idx: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }

    setAddingId(idx);
    try {
      // Fetch full details including description and category using existing extract API
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: book.yes24Url }),
      });

      if (!response.ok) throw new Error('Failed to extract details');
      const fullDetail = await response.json();

      await saveBook({
        title: fullDetail.title || book.title,
        author: fullDetail.author || book.author,
        coverImage: fullDetail.coverImage || book.coverImage || 'https://image.yes24.com/momo/Noimg_L.jpg',
        category: fullDetail.category || book.publisher,
        publishDate: fullDetail.publishDate || book.publishDate,
        price: fullDetail.price || book.price,
        description: fullDetail.description,
        readingStatus: 'READING',
        progress: 0,
      });

      alert(`'${book.title}'이(가) 상세 정보와 함께 서재에 추가되었습니다.`);
    } catch (error) {
      console.error(error);
      alert('서재 추가에 실패했습니다.');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header title="Yes24 베스트 100" transparent />

      <main className="mt-6 px-4">
        <div className="flex flex-col gap-6 mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Yes24 {category === 'total' ? '종합' : category === 'economy' ? '경제' : '에세이'} 베스트 100
          </h2>

          <div className="flex p-1 bg-slate-100 rounded-xl w-full">
            <button
              onClick={() => setCategory('total')}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all",
                category === 'total' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              종합
            </button>
            <button
              onClick={() => setCategory('economy')}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                category === 'economy' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              경제
            </button>
            <button
              onClick={() => setCategory('essay')}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                category === 'essay' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              에세이
            </button>
          </div>
        </div>

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
              <div
                key={idx}
                className="group relative bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-primary/20 transition-colors"
              >
                <a
                  href={book.yes24Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-3 pr-12 rounded-2xl"
                >
                  <div className="relative shrink-0">
                    <div
                      className="w-20 h-28 bg-center bg-no-repeat bg-cover rounded-lg border border-slate-50 shadow-sm"
                      style={{ backgroundImage: `url("${book.coverImage}")` }}
                    />
                    <div className="absolute -top-2 -left-2 size-6 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
                      {idx + 1}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-900 line-clamp-2 leading-snug mb-1">{book.title}</p>
                    <p className="text-sm text-slate-500 truncate">{book.author} · {book.publisher}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-slate-400">{book.publishDate}</p>
                      <p className="text-xs font-bold text-primary">{book.price}</p>
                    </div>
                  </div>
                </a>

                {session && (
                  <button
                    onClick={(e) => handleAddBook(e, book, idx)}
                    disabled={addingId === idx}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 size-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-90 disabled:opacity-50"
                    title="내 서재에 추가"
                  >
                    {addingId === idx ? (
                      <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-xl">library_add</span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav activeTab="best" />
    </div>
  );
}
