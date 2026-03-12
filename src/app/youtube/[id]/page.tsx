'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import {
  getYoutubeVideoById,
  deleteYoutubeVideo,
  updateYoutubeVideo,
  getGeminiModels,
  getGeminiPrompts
} from '@/lib/db';
import { notFound, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface YoutubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  published_at: string;
  summary: string;
  description: string;
  added_at: string;
  user_id: string;
}

export default function YoutubeDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [video, setVideo] = useState<YoutubeVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);

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

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(video?.url || '').then(() => {
      alert('URL이 클립보드에 복사되었습니다.');
    });
  };

  const handleRefetch = async () => {
    if (!confirm('AI를 사용하여 정보를 다시 가져오시겠습니까? 기존 요약 내용이 덮어씌워집니다.')) return;

    setIsRefetching(true);
    try {
      // Load user settings for Gemini
      const dbModels = await getGeminiModels();
      const dbPrompts = await getGeminiPrompts();

      const defaultModel = dbModels.find(m => m.is_default) || dbModels[0];
      const defaultPrompt = dbPrompts.find(p => p.is_default) || dbPrompts[0];

      const response = await fetch('/api/youtube/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: video.url,
          model: defaultModel?.name,
          prompt: defaultPrompt?.content
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to extract video info');

      const updateResult = await updateYoutubeVideo(video.id, {
        title: data.title || video.title,
        thumbnail: data.thumbnail || video.thumbnail,
        duration: data.duration || video.duration,
        published_at: data.publishDate || video.published_at,
        summary: data.summary || '',
        description: data.description || '',
      });

      if (updateResult.success) {
        setVideo({
          ...video,
          title: data.title || video.title,
          thumbnail: data.thumbnail || video.thumbnail,
          duration: data.duration || video.duration,
          published_at: data.publishDate || video.published_at,
          summary: data.summary || '',
          description: data.description || '',
        });
        alert('정보가 업데이트되었습니다.');
      } else {
        alert(`업데이트 실패: ${updateResult.error}`);
      }
    } catch (error) {
      console.error('Refetch error:', error);
      alert(`다시 가져오기 실패: ${error instanceof Error ? error.message : '오류가 발생했습니다.'}`);
    } finally {
      setIsRefetching(false);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="유튜브 기록"
        showBack
        rightAction={
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefetch}
              disabled={isRefetching || isDeleting}
              className="text-primary hover:bg-primary/5 p-2 rounded-full transition-colors disabled:opacity-50"
              title="다시 가져오기"
            >
              <span className={cn("material-symbols-outlined", isRefetching && "animate-spin")}>sync</span>
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting || isRefetching}
              className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors disabled:opacity-50"
              title="기록 삭제"
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        }
      />

      <main className="p-4 space-y-6">
        <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg border border-slate-100 dark:border-primary/10">
           {/* eslint-disable-next-line @next/next/no-img-element */}
           <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{video.title}</h1>
          <div className="flex gap-3 text-sm text-slate-500 dark:text-slate-400 font-medium">
             <span>{video.duration}</span>
             <span>•</span>
             <span>{video.published_at}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary text-sm font-bold"
            >
              <span className="material-symbols-outlined text-sm">link</span>
              유튜브에서 보기
            </a>
            <button
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-primary text-sm font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              URL 복사
            </button>
            <a
              href={`mailto:?subject=${encodeURIComponent(`[유튜브 요약] ${video.title}`)}&body=${encodeURIComponent(`제목: ${video.title}\nURL: ${video.url}\n\n요약:\n${video.summary}`)}`}
              className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-primary text-sm font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-sm">mail</span>
              메일 송부
            </a>
          </div>
        </div>

        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
               <span className="material-symbols-outlined text-primary">auto_awesome</span>
               AI 요약 분석
            </h2>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-primary/10 prose dark:prose-invert prose-slate prose-sm max-w-none shadow-inner">
               <ReactMarkdown>{video.summary}</ReactMarkdown>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
               <span className="material-symbols-outlined text-slate-400">description</span>
               상세 설명
            </h2>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-primary/10 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed shadow-inner">
               {video.description || "설명이 없습니다."}
            </div>
          </div>
        </section>
      </main>

      <BottomNav activeTab="library" />
    </div>
  );
}
