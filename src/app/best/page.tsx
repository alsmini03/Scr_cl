'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { saveBook } from '@/lib/db';
import { useSession } from 'next-auth/react';

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
  const [books, setBooks] = useState<BestBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingId, setAddingId] = useState<number | null>(null);

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

  const handleAddBook = async (e: React.MouseEvent, book: BestBook, idx: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }

    setAddingId(idx);
    try {
      await saveBook({
        title: book.title,
        author: book.author,
        coverImage: book.coverImage || 'https://image.yes24.com/momo/Noimg_L.jpg',
        category: book.publisher,
        publishDate: book.publishDate,
        price: book.price,
        description: `${book.publisher} 출판 / 베스트셀러 순위권 도서`,
        readingStatus: 'READING',
        progress: 0,
      });
      alert(`'${book.title}'이(가) 내 서재에 추가되었습니다.`);
    } catch (error) {
      console.error(error);
      alert('서재 추가에 실패했습니다.');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header title="베스트셀러" transparent />

      <main className="mt-6 px-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Yes24 종합 베스트 100</h2>

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
                className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-primary/20 transition-colors relative"
              >
                <a
                  href={book.yes24Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 z-0 rounded-2xl"
                />

                <div className="relative shrink-0 z-10">
                  <div
                    className="w-16 h-22 bg-center bg-no-repeat bg-cover rounded-lg border border-slate-50"
                    style={{ backgroundImage: `url("${book.coverImage}")` }}
                  />
                  <div className="absolute -top-2 -left-2 size-6 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
                    {idx + 1}
                  </div>
                </div>

                <div className="flex-1 min-w-0 z-10 pr-12">
                  <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug mb-1">{book.title}</p>
                  <p className="text-xs text-slate-500 truncate">{book.author} · {book.publisher}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] text-slate-400">{book.publishDate}</p>
                    <p className="text-[10px] font-bold text-primary">{book.price}</p>
                  </div>
                </div>

                {session && (
                  <button
                    onClick={(e) => handleAddBook(e, book, idx)}
                    disabled={addingId === idx}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 size-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-90 disabled:opacity-50"
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
