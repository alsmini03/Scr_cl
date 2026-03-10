import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getYoutubeVideoById } from '@/lib/db';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

export default async function YoutubeDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const video = await getYoutubeVideoById(id);

  if (!video) {
    notFound();
  }

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header title="유튜브 기록" showBack />

      <main className="p-4 space-y-6">
        <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg border border-slate-100">
           {/* eslint-disable-next-line @next/next/no-img-element */}
           <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{video.title}</h1>
          <div className="flex gap-3 text-sm text-slate-500 font-medium">
             <span>{video.duration}</span>
             <span>•</span>
             <span>{video.published_at}</span>
          </div>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary text-sm font-bold mt-1"
          >
            <span className="material-symbols-outlined text-sm">link</span>
            유튜브에서 보기
          </a>
        </div>

        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
               <span className="material-symbols-outlined text-primary">auto_awesome</span>
               AI 요약 분석
            </h2>
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 prose prose-slate prose-sm max-w-none shadow-inner">
               <ReactMarkdown>{video.summary}</ReactMarkdown>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
               <span className="material-symbols-outlined text-slate-400">description</span>
               상세 설명
            </h2>
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed shadow-inner">
               {video.description || "설명이 없습니다."}
            </div>
          </div>
        </section>
      </main>

      <BottomNav activeTab="home" />
    </div>
  );
}
