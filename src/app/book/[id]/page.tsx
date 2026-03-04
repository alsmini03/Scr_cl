'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Book } from '@/types/book';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';
import { getBookById, updateBook, deleteBook } from '@/lib/storage';

export default function BookDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);

  const [status, setStatus] = useState<'READING' | 'FINISHED'>('READING');
  const [rating, setRating] = useState(0);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const data = getBookById(id as string);
      if (data) {
        setBook(data);
        setStatus(data.readingStatus);
        setRating(data.rating || 0);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [id]);

  const handleSave = () => {
    if (!book) return;

    const updatedBook: Book = {
      ...book,
      readingStatus: status,
      rating: rating,
      notes: notesRef.current?.value || '',
    };

    updateBook(updatedBook);
    alert('기록이 저장되었습니다.');
    router.push('/');
  };

  const handleDelete = () => {
    if (!book) return;

    if (confirm('정말로 이 책을 삭제하시겠습니까?')) {
      deleteBook(book.id);
      alert('책이 삭제되었습니다.');
      router.push('/');
    }
  };

  if (!book) {
    return <div className="p-8 text-center mt-20">
      <p className="text-slate-500 mb-4">도서를 찾을 수 없습니다.</p>
      <button onClick={() => router.push('/')} className="text-primary font-bold">서재로 돌아가기</button>
    </div>;
  }

  return (
    <div className="font-display min-h-screen">
      <Header
        title="독서 기록"
        showBack
        rightAction={
          <button
            onClick={handleDelete}
            className="flex items-center justify-center rounded-lg h-10 w-10 bg-transparent text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
        }
      />

      <main className="flex-1 pb-24">
        {/* Cover Art Section */}
        <div className="px-4 py-6">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-full md:w-1/3 aspect-[2/3] bg-primary/10 rounded-xl overflow-hidden shadow-xl">
              <div
                className="w-full h-full bg-center bg-no-repeat bg-cover"
                style={{ backgroundImage: `url("${book.coverImage}")` }}
              ></div>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              {book.category && (
                <span className="inline-flex w-fit px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                  {book.category}
                </span>
              )}
              <h1 className="text-slate-900 dark:text-slate-100 text-4xl font-bold leading-tight">
                {book.title}
              </h1>
              <p className="text-primary text-xl font-semibold">{book.author}</p>
              {book.publishDate && (
                <p className="text-slate-500 dark:text-slate-400 text-sm italic">출판: {book.publishDate}</p>
              )}
              {book.price && (
                <p className="text-slate-500 dark:text-slate-400 text-sm">가격: {book.price}</p>
              )}

              <div className="mt-4">
                <h3 className="font-bold text-lg mb-1">책 소개</h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {book.description || "상세 정보가 없습니다."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* User Recording Section */}
        <section className="px-4 py-6 space-y-8 bg-white/50 dark:bg-primary/5 rounded-t-[2.5rem] mt-4 shadow-inner">
          {/* Status & Rating */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">독서 상태</label>
              <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
                <button
                  onClick={() => setStatus('READING')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all",
                    status === 'READING' ? "bg-primary text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  읽는 중
                </button>
                <button
                  onClick={() => setStatus('FINISHED')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all",
                    status === 'FINISHED' ? "bg-primary text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  완독
                </button>
              </div>
            </div>

            <div className="space-y-3 text-center md:text-left">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">내 평점</label>
              <div className="flex justify-center md:justify-start gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setRating(s)}>
                    <span
                      className={cn(
                        "material-symbols-outlined scale-125 transition-all",
                        rating >= s ? "text-primary fill-1" : "text-slate-300 dark:text-slate-700"
                      )}
                    >
                      star
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">독서 노트</label>
            <textarea
              ref={notesRef}
              className="w-full h-48 p-4 rounded-xl border-2 border-primary/10 bg-white dark:bg-slate-900 focus:border-primary focus:ring-0 text-slate-900 dark:text-slate-100 font-display text-lg placeholder:italic placeholder:text-slate-400 outline-none"
              placeholder="가장 좋아하는 문구, 테마 또는 생각들을 적어보세요..."
              defaultValue={book.notes}
            ></textarea>
          </div>

          {/* Action Button */}
          <div className="pt-4">
            <button
              onClick={handleSave}
              className="w-full py-4 bg-primary hover:opacity-90 transition-opacity text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">save</span> 기록 저장하기
            </button>
          </div>
        </section>
      </main>

      <BottomNav activeTab="library" />

      <style jsx global>{`
        .fill-1 {
          font-variation-settings: 'FILL' 1;
        }
      `}</style>
    </div>
  );
}
