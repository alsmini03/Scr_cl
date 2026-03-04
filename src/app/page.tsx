import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { getBooks } from '@/lib/db';
import { auth } from '@/auth';

export default async function LibraryPage() {
  const session = await auth();
  const books = session?.user ? await getBooks() : [];

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header title="내 서재" transparent />

      <main className="mt-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">내 도서</h2>
          <div className="flex gap-2 text-primary">
            <span className="material-symbols-outlined">filter_list</span>
            <span className="material-symbols-outlined">grid_view</span>
          </div>
        </div>

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
                    book.progress !== undefined && book.progress > 0 ? (
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
                      <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-[10px] font-bold ml-0.5">{book.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
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
