'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState } from 'react';
import { saveYoutubeVideo } from '@/lib/db';
import { useRouter } from 'next/navigation';

interface YouTubeMetadata {
  title: string;
  description: string;
  thumbnail: string;
  url: string;
}

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
  const [description, setDescription] = useState('');
  const [transcript, setTranscript] = useState('');

  const handleExtract = async () => {
    if (!url) return;

    setIsExtracting(true);
    setError(null);

    try {
      const response = await fetch('/api/youtube/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract video info');
      }

      const data = await response.json();
      setMetadata({ ...data, url });
      setTitle(data.title || '');
      setDescription(data.description || '');
      setDuration(data.duration || '00:00');
      setTranscript(data.transcript || '');

      // Use extracted date if available, otherwise fallback to today
      setPublishedAt(data.publishDate || new Date().toISOString().split('T')[0]);
    } catch (err: unknown) {
      console.error('YouTube Extraction error:', err);
      setError('정보를 가져오는 데 실패했습니다.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!title || !url) return;

    setIsSaving(true);
    try {
      await saveYoutubeVideo({
        title,
        url,
        thumbnail: metadata?.thumbnail,
        duration,
        published_at: publishedAt,
        description: `${description}\n\n[스크립트]\n${transcript}`,
      });

      alert('유튜브 영상 정보가 저장되었습니다.');
      router.push('/');
    } catch (error) {
      console.error('Failed to save youtube video:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="font-display min-h-screen flex flex-col bg-white">
      <Header title="유튜브 정보 가져오기" showBack />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 pb-32">
        {/* Switch Mode Tab */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => router.push('/add')}
            className="flex-1 py-3 px-4 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            도서 검색
          </button>
          <button className="flex-1 py-3 px-4 rounded-lg text-sm font-bold bg-white text-primary shadow-sm">
            유튜브 정보 가져오기
          </button>
        </div>

        <section className="mb-6">
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
                  <span className="text-[12px] leading-tight">가져오기</span>
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-1 ml-1">{error}</p>}
            </div>
          </div>
        </section>

        {/* Preview State */}
        <section className="border border-dashed border-primary/20 rounded-2xl p-6 mb-8 flex flex-col items-center justify-center text-center bg-primary/5 min-h-48 relative overflow-hidden">
          {metadata?.thumbnail ? (
            <div className="absolute inset-0 z-0">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={metadata.thumbnail} alt="thumbnail" className="w-full h-full object-cover opacity-30" />
            </div>
          ) : null}

          <div className="relative z-10">
            <div className="size-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto text-primary">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
            </div>
            <h3 className="font-bold text-lg mb-1">동영상 미리보기</h3>
            <p className="text-slate-500 text-sm">URL을 입력하면 썸네일이 여기에 표시됩니다.</p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 transition-all outline-none"
              placeholder="영상 제목을 입력하세요"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">재생 시간</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 transition-all outline-none"
                placeholder="00:00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">등록일자</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">내용</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary min-h-32 p-4 transition-all outline-none"
              placeholder="동영상에 대한 상세 내용을 입력하세요"
            ></textarea>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">스크립트</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary min-h-64 p-4 transition-all outline-none"
              placeholder="자막(스크립트) 정보가 여기에 표시됩니다."
            ></textarea>
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
