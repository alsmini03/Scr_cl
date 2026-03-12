'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Book } from '@/types/book';
import { getDeletedBooks, restoreBook, permanentlyDeleteBook } from '@/lib/db';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TrashPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchTrash() {
      try {
        const data = await getDeletedBooks();
        setBooks(data);
      } catch (error) {
        console.error('Failed to fetch trash:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchTrash();
  }, []);

  const handleRestore = async (id: string) => {
    try {
      await restoreBook(id);
      setBooks(books.filter(b => b.id !== id));
      alert('도서가 복구되었습니다.');
    } catch (error) {
      alert('복구에 실패했습니다.');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (confirm('이 도서를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      try {
        await permanentlyDeleteBook(id);
        setBooks(books.filter(b => b.id !== id));
        alert('영구 삭제되었습니다.');
      } catch (error) {
        alert('삭제에 실패했습니다.');
      }
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header title="휴지통" showBack />

      <main className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
            <span className="material-symbols-outlined text-6xl mb-4">delete_outline</span>
            <p>휴지통이 비어 있습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 px-1 mb-4">
              삭제된 도서들이 여기에 보관됩니다. 영구 삭제 전까지는 언제든지 복구할 수 있습니다.
            </p>
            {books.map((book) => (
              <div key={book.id} className="flex gap-4 p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-primary/10 shadow-sm">
                <div
                  className="w-16 h-24 bg-center bg-no-repeat bg-cover rounded-lg shrink-0 shadow-sm grayscale"
                  style={{ backgroundImage: `url("${book.coverImage}")` }}
                />
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <p className="font-bold truncate text-slate-900 dark:text-slate-100">{book.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{book.author}</p>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleRestore(book.id)}
                      className="flex-1 py-2 bg-white dark:bg-slate-800 border border-primary text-primary text-xs font-bold rounded-lg hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">restore</span>
                      복구
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(book.id)}
                      className="flex-1 py-2 bg-white dark:bg-slate-800 border border-red-500 text-red-500 text-xs font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">delete_forever</span>
                      영구 삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav activeTab="profile" />
    </div>
  );
}
