import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { getBooks } from '@/lib/db';
import { auth } from '@/auth';
import BookGrid from '@/components/BookGrid';
import { cn } from '@/lib/utils';
import { getYoutubeVideos } from '@/lib/db';

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const sessionPromise = auth();
  const booksPromise = getBooks();
  const youtubePromise = getYoutubeVideos();
  const { mode: modeParam } = await searchParams;

  const [session, books, youtubeVideos] = await Promise.all([
    sessionPromise,
    booksPromise,
    youtubePromise
  ]);

  const mode = modeParam || 'books';

  // Bypass login for development if needed, but for visual verification we might need to mock it
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header title="내 서재" transparent />

      <main className="mt-6 px-4">
        {/* Toggle Mode */}
        <div className="flex gap-2 mb-8 p-1 bg-slate-100 rounded-2xl max-w-xs mx-auto">
          <Link
            href="/?mode=books"
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center",
              mode === 'books' ? "bg-white text-primary shadow-sm" : "text-slate-500"
            )}
          >
            도서
          </Link>
          <Link
            href="/?mode=youtube"
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center",
              mode === 'youtube' ? "bg-white text-primary shadow-sm" : "text-slate-500"
            )}
          >
            유튜브
          </Link>
        </div>

        {!session?.user && !isDev ? (
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
        ) : mode === 'books' ? (
           books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
              <span className="material-symbols-outlined text-6xl mb-4">library_books</span>
              <p>아직 등록된 책이 없습니다.</p>
              <Link href="/add" className="text-primary text-sm font-bold mt-2">새 책 추가하기</Link>
            </div>
          ) : (
            <BookGrid books={books} />
          )
        ) : (
          youtubeVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
              <span className="material-symbols-outlined text-6xl mb-4">video_library</span>
              <p>저장된 유튜브 영상이 없습니다.</p>
              <Link href="/add/youtube" className="text-primary text-sm font-bold mt-2">유튜브 정보 가져오기</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {youtubeVideos.map((video) => (
                <Link
                  key={video.id}
                  href={`/youtube/${video.id}`}
                  className="flex flex-col bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 shadow-sm active:scale-[0.98] transition-all"
                >
                  <div className="aspect-video relative w-full overflow-hidden">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                     <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                       {video.duration}
                     </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 line-clamp-2 mb-1">{video.title}</h3>
                    <p className="text-xs text-slate-500 font-medium">{video.published_at}</p>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </main>

      {(session?.user || isDev) && (
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
