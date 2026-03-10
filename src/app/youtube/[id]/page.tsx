'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getYoutubeVideoById, deleteYoutubeVideo } from '@/lib/db';
import { notFound, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export default function YoutubeDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadVideo() {
      const { id } = await params;
      const data = await getYoutubeVideoById(id);
      if (data) {
        setVideo(data);
      }
      setLoading(false);
    }
    loadVideo();
  }, [params]);

  if (loading) {
    return (
      <div className="font-display min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin text-primary">
          <span className="material-symbols-outlined text-4xl">sync</span>
        </div>
      </div>
    );
  }

  if (!video) {
    notFound();
  }

  const handleDelete = async () => {
    if (!confirm('정말로 이 기록을 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      const result = await deleteYoutubeVideo(video.id);
      if (result.success) {
        alert('삭제되었습니다.');
        router.push('/?mode=youtube');
      } else {
        alert(`삭제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header
        title="유튜브 기록"
        showBack
        rightAction={
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors disabled:opacity-50"
            title="기록 삭제"
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
        }
      />

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
