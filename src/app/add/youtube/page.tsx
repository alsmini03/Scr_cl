'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState } from 'react';
import { saveYoutubeVideo } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface YouTubeMetadata {
  title: string;
  description: string;
  thumbnail: string;
  url: string;
}

import ReactMarkdown from 'react-markdown';

export default function AddYouTubePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [metadata, setMetadata] = useState<YouTubeMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('00:00');
  const [publishedAt, setPublishedAt] = useState('');
  const [summary, setSummary] = useState('');
  const [transcript, setTranscript] = useState('');

  const handleExtract = async () => {
    if (!url) return;

    setIsExtracting(true);
    setError(null);
    setSummary('');
    setTranscript('');

    try {
      const response = await fetch('/api/youtube/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract video info');
      }

      setMetadata({ ...data, url });
      setTitle(data.title || '');
      // 설명 field gets the actual YouTube description (fetched via URL)
      setSummary(data.description || '');
      // 요약 field gets the AI generated summary
      setTranscript(data.summary || '');
      setDuration(data.duration || '00:00');

      // Use extracted date if available, otherwise fallback to today
      setPublishedAt(data.publishDate || new Date().toISOString().split('T')[0]);
    } catch (err: unknown) {
      console.error('YouTube Extraction error:', err);
      const msg = err instanceof Error ? err.message : '정보를 가져오는 데 실패했습니다.';
      setError(msg);
      // Display Gemini error in the Summary field if applicable
      if (msg.includes('Gemini') || msg.includes('token')) {
          setTranscript(`### 오류 발생\n\n${msg}`);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!title || !url) return;

    setIsSaving(true);
    try {
      const result = await saveYoutubeVideo({
        title,
        url,
        thumbnail: metadata?.thumbnail,
        duration,
        published_at: publishedAt,
        summary: transcript, // UI "요약" renders transcript state (AI Summary)
        description: summary, // UI "설명" renders summary state (Actual YT Desc)
      });

      if (result.success) {
        alert('유튜브 영상 정보가 저장되었습니다.');
        router.push('/');
      } else {
        alert(`저장에 실패했습니다: ${result.error}`);
      }
    } catch (error) {
      console.error('Unexpected error during save:', error);
      alert('저장 중 알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="font-display min-h-screen flex flex-col bg-white">
      <Header title="유튜브" showBack />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 pb-32">
        {/* Switch Mode Tab */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => router.push('/add')}
            className="flex-1 py-3 px-4 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Yes24
          </button>
          <button className="flex-1 py-3 px-4 rounded-lg text-sm font-bold bg-white text-primary shadow-sm">
            Youtube
          </button>
        </div>

        <section className="mb-10">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 ml-1">유튜브 영상 URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 rounded-xl border border-primary/20 bg-white text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 transition-all outline-none"
                  placeholder="https://www.youtube.com/.."
                />
                <button
                  onClick={handleExtract}
                  disabled={isExtracting}
                  className="bg-primary hover:bg-primary/90 text-white font-bold px-3 rounded-xl transition-colors flex flex-col items-center justify-center gap-0 disabled:opacity-50 min-w-[80px]"
                >
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  <span className="text-[12px] leading-tight">
                    {isExtracting ? '가져오는 중' : '가져오기'}
                  </span>
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-1 ml-1">{error}</p>}
            </div>
          </div>
        </section>

        {/* Preview State - Vertical Layout for YouTube */}
        <section className="border-t border-primary/10 pt-6">
          <div className={cn("mt-4 transition-opacity", !metadata && !isExtracting && "opacity-50 pointer-events-none select-none")}>
            <div className="flex flex-col gap-6">
              {/* Video Thumbnail - Full Width 16:9 */}
              <div className="w-full aspect-video bg-slate-50 rounded-xl flex flex-col items-center justify-center shrink-0 border border-slate-200 overflow-hidden shadow-sm relative">
                {metadata?.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={metadata.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-slate-400 text-5xl mb-2">play_circle</span>
                    <span className="text-xs text-slate-400 font-medium">미리보기</span>
                  </>
                )}
                {isExtracting && <div className="absolute inset-0 bg-white/50 animate-pulse flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span></div>}
              </div>

              {/* Metadata - Below Thumbnail */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">제목</label>
                  <div className={cn(
                    "min-h-12 bg-slate-50 rounded-xl px-4 py-3 flex items-center text-sm font-medium text-slate-900 border border-slate-100 shadow-inner break-words",
                    isExtracting && "animate-pulse"
                  )}>
                    {isExtracting ? "가져오는 중..." : (title || "영상 제목")}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">재생 시간</label>
                    <div className={cn(
                      "h-12 bg-slate-50 rounded-xl px-4 flex items-center text-sm text-slate-900 border border-slate-100 shadow-inner",
                      isExtracting && "animate-pulse"
                    )}>
                      {isExtracting ? "--:--" : (duration || "00:00")}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">등록일자</label>
                    <div className={cn(
                      "h-12 bg-slate-50 rounded-xl px-4 flex items-center text-sm text-slate-900 border border-slate-100 shadow-inner",
                      isExtracting && "animate-pulse"
                    )}>
                      {isExtracting ? "YYYY-MM-DD" : (publishedAt || "2024-01-01")}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">설명</label>
                  <div className={cn(
                    "min-h-32 bg-slate-50 rounded-xl p-4 text-sm text-slate-900 border border-slate-100 shadow-inner whitespace-pre-wrap overflow-hidden",
                    isExtracting && "animate-pulse"
                  )}>
                    {isExtracting ? "유튜브 설명을 가져오는 중입니다..." : (summary || "동영상에 대한 설명이 여기에 표시됩니다.")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={cn("mt-6 space-y-6 transition-opacity", !metadata && !isExtracting && "opacity-50 pointer-events-none select-none")}>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">요약</label>
            {isExtracting ? (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 p-4 min-h-64 shadow-inner animate-pulse flex flex-col gap-2">
                 <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                 <div className="h-4 bg-slate-200 rounded w-full"></div>
                 <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                 <div className="mt-4 text-slate-400 text-sm italic">AI가 영상을 분석하여 요약 중입니다. 잠시만 기다려 주세요...</div>
              </div>
            ) : transcript ? (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 p-4 prose prose-sm max-w-none shadow-inner">
                <ReactMarkdown>{transcript}</ReactMarkdown>
              </div>
            ) : (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-500 min-h-64 p-4 shadow-inner">
                요약 내용이 여기에 마크다운으로 표시됩니다.
              </div>
            )}
          </div>
        </section>

        <div className="mt-10">
          <button
            onClick={handleSave}
            disabled={!title || isSaving}
            className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">save</span>
            {isSaving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </main>

      <BottomNav activeTab="home" />
    </div>
  );
}
