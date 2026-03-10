import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { getYoutubeVideos } from '@/lib/db';
import { auth } from '@/auth';

export default async function YoutubeListPage() {
  const session = await auth();
  const videos = await getYoutubeVideos();

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header title="유튜브 기록" />

      <main className="mt-6 px-4">
        {!session?.user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-primary">lock</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">로그인이 필요합니다</h3>
            <p className="text-slate-500 mb-8 px-8">유튜브 기록을 보려면 먼저 로그인해 주세요.</p>
            <Link
              href="/login"
              className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
            >
              로그인하기
            </Link>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-6xl mb-4">video_library</span>
            <p>아직 저장된 영상이 없습니다.</p>
            <p className="text-sm">새로운 영상을 추가해 보세요!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {videos.map((video) => (
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
                  <p className="text-xs text-slate-500">{video.published_at}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <BottomNav activeTab="home" />
    </div>
  );
}
