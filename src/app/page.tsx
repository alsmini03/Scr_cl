import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { getBooks } from '@/lib/db';
import { auth } from '@/auth';
import BookGrid from '@/components/BookGrid';

export default async function LibraryPage() {
  const sessionPromise = auth();
  const booksPromise = getBooks();

  const [session, books] = await Promise.all([sessionPromise, booksPromise]);

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header title="내 서재" transparent />

      <main className="mt-6 px-4">
        {!session?.user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-primary">lock</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">로그인이 필요합니다</h3>
            <p className="text-slate-500 mb-8 px-8">서재를 이용하고 독서 기록을 남기려면 먼저 로그인해 주세요.</p>
            <Link
              href="/login"
              className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
            >
              로그인하기
            </Link>
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-6xl mb-4">library_books</span>
            <p>아직 등록된 책이 없습니다.</p>
            <p className="text-sm">새 책을 추가해 보세요!</p>
          </div>
        ) : (
          <BookGrid books={books} />
        )}
      </main>

      {session?.user && (
        <Link
          href="/add"
          className="fixed bottom-24 right-6 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-transform z-20"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </Link>
      )}

      <BottomNav activeTab="home" />
    </div>
  );
}
