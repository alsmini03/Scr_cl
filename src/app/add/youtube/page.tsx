'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState, useEffect } from 'react';
import {
  saveYoutubeVideo,
  getGeminiModels,
  getGeminiPrompts,
} from '@/lib/db';
import { useRouter } from 'next/navigation';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';
import he from 'he';
import ReactMarkdown from 'react-markdown';

interface YouTubeMetadata {
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  duration?: string;
  publishDate?: string;
  summary?: string;
}

interface GeminiModel {
  id: string;
  name: string;
  is_default: boolean;
}

interface GeminiPrompt {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
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
  const [summary, setSummary] = useState('');
  const [transcript, setTranscript] = useState('');

  // Gemini Settings
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [prompts, setPrompts] = useState<GeminiPrompt[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState('');

  const [isAutoAdding, setIsAutoAdding] = useState(false);

  const loadSettings = async () => {
    const dbModels = await getGeminiModels();
    const dbPrompts = await getGeminiPrompts();

    setModels(dbModels);
    const defaultModel = dbModels.find(m => m.is_default) || dbModels[0];
    if (defaultModel) setSelectedModel(defaultModel.name);

    setPrompts(dbPrompts);
    const defaultPrompt = dbPrompts.find(p => p.is_default) || dbPrompts[0];
    if (defaultPrompt) setSelectedPromptId(defaultPrompt.id);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleExtract = async () => {
    if (!url) return;

    setIsExtracting(true);
    setError(null);
    setSummary('');
    setTranscript('');

    try {
      const selectedPrompt = prompts.find(p => p.id === selectedPromptId);
      const response = await fetch('/api/youtube/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          model: selectedModel,
          prompt: selectedPrompt?.content
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract video info');
      }

      setMetadata({ ...data, url });
      setTitle(data.title || '');
      setSummary(data.description || '');
      setTranscript(data.summary || '');
      setDuration(data.duration || '00:00');
      setPublishedAt(data.publishDate || new Date().toISOString().split('T')[0]);
    } catch (err: unknown) {
      console.error('YouTube Extraction error:', err);
      const msg = err instanceof Error ? err.message : '정보를 가져오는 데 실패했습니다.';
      setError(msg);
      if (msg.includes('Gemini') || msg.includes('token')) {
          setTranscript(`### 오류 발생\n\n${msg}`);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async (showSuccessAlert = true) => {
    if (!title || !url) return { success: false, error: 'Title and URL are required' };

    setIsSaving(true);
    try {
      const result = await saveYoutubeVideo({
        title,
        url,
        thumbnail: metadata?.thumbnail,
        duration,
        published_at: publishedAt,
        summary: transcript,
        description: summary,
      });

      if (result.success) {
        if (showSuccessAlert) alert('유튜브 영상 정보가 저장되었습니다.');
        return { success: true };
      } else {
        if (showSuccessAlert) alert(`저장에 실패했습니다: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Unexpected error during save:', error);
      if (showSuccessAlert) alert('저장 중 알 수 없는 오류가 발생했습니다.');
      return { success: false, error: 'Unknown error' };
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoAdd = async () => {
    if (!url) return;

    setIsAutoAdding(true);
    setError(null);
    setSummary('');
    setTranscript('');

    try {
      const selectedPrompt = prompts.find(p => p.id === selectedPromptId);
      const response = await fetch('/api/youtube/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          model: selectedModel,
          prompt: selectedPrompt?.content
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to extract video info');

      setMetadata({ ...data, url });
      setTitle(data.title || '');
      setSummary(data.description || '');
      setTranscript(data.summary || '');
      setDuration(data.duration || '00:00');
      const pubAt = data.publishDate || new Date().toISOString().split('T')[0];
      setPublishedAt(pubAt);

      const saveResult = await saveYoutubeVideo({
        title: data.title || 'Untitled Video',
        url,
        thumbnail: data.thumbnail,
        duration: data.duration || '00:00',
        published_at: pubAt,
        summary: data.summary || '',
        description: data.description || '',
      });

      if (saveResult.success) {
        alert('자동 추가되었습니다.');
        router.push('/');
      } else {
        alert(`자동 저장 실패: ${saveResult.error}`);
      }
    } catch (err: unknown) {
      console.error('Auto Add error:', err);
      setError(err instanceof Error ? err.message : '자동 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAutoAdding(false);
    }
  };

  return (
    <div className="font-display min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header title="유튜브" showBack />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 pb-48">
        <div className="flex gap-2 mb-6 p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => router.push('/add?tab=yes24')}
            className="flex-1 py-3 px-4 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-colors"
          >
            Yes24
          </button>
          <button className="flex-1 py-3 px-4 rounded-lg text-sm font-bold bg-white dark:bg-slate-700 text-primary shadow-sm">
            Youtube
          </button>
          <button
            onClick={() => router.push('/add?tab=blog')}
            className="flex-1 py-3 px-4 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-colors"
          >
            블로그
          </button>
        </div>

        <section className="mb-10 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">유튜브 영상 URL</label>
                <button
                  onClick={() => router.push('/settings/gemini')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold border border-slate-200 dark:border-primary/10 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">settings_suggest</span>
                  제미나이 설정
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-xl border border-primary/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 transition-all outline-none"
                  placeholder="https://www.youtube.com/.."
                />

                {/* Model & Prompt Selection Row */}
                <div className="grid grid-cols-2 gap-3">
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 h-12 px-3 text-xs outline-none appearance-none"
                    >
                        {models.map(model => (
                            <option key={model.id} value={model.name}>{model.name}</option>
                        ))}
                    </select>
                    <select
                        value={selectedPromptId}
                        onChange={(e) => setSelectedPromptId(e.target.value)}
                        className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 h-12 px-3 text-xs outline-none appearance-none"
                    >
                        {prompts.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleExtract}
                    disabled={isExtracting || isAutoAdding}
                    className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg">description</span>
                    <span className="text-sm font-bold">
                      {isExtracting ? '분석 중' : '가져오기'}
                    </span>
                  </button>
                  <button
                    onClick={handleAutoAdd}
                    disabled={isExtracting || isAutoAdding}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                    <span className="text-sm font-bold">
                      {isAutoAdding ? '추가 중' : '자동 추가'}
                    </span>
                  </button>
                </div>
              </div>
              {error && <p className="text-red-500 text-sm mt-1 ml-1">{error}</p>}
            </div>
          </div>
        </section>

        <section className="border-t border-primary/10 pt-6">
          <div className={cn("mt-4 transition-opacity", !metadata && !isExtracting && !isAutoAdding && "opacity-50 pointer-events-none select-none")}>
            <div className="flex flex-col gap-6">
              <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl flex flex-col items-center justify-center shrink-0 border border-slate-200 dark:border-primary/10 overflow-hidden shadow-sm relative group">
                {metadata?.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={metadata.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-slate-400 text-5xl mb-2">play_circle</span>
                    <span className="text-xs text-slate-400 font-medium">미리보기</span>
                  </>
                )}
                {(isExtracting || isAutoAdding) && <div className="absolute inset-0 bg-white/50 animate-pulse flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span></div>}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">제목</label>
                  <div className={cn(
                    "min-h-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 flex items-center text-sm font-medium text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-primary/10 shadow-inner break-words",
                    (isExtracting || isAutoAdding) && "animate-pulse"
                  )}>
                    {(isExtracting || isAutoAdding) ? "가져오는 중..." : (title || "영상 제목")}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">재생 시간</label>
                    <div className={cn(
                      "h-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 flex items-center text-sm text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-primary/10 shadow-inner",
                      (isExtracting || isAutoAdding) && "animate-pulse"
                    )}>
                      {(isExtracting || isAutoAdding) ? "--:--" : (duration || "00:00")}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">등록일자</label>
                    <div className={cn(
                      "h-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 flex items-center text-sm text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-primary/10 shadow-inner",
                      (isExtracting || isAutoAdding) && "animate-pulse"
                    )}>
                      {(isExtracting || isAutoAdding) ? "YYYY-MM-DD" : (publishedAt || "2024-01-01")}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">설명</label>
                  <div className={cn(
                    "min-h-32 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-primary/10 shadow-inner whitespace-pre-wrap overflow-hidden break-words",
                    (isExtracting || isAutoAdding) && "animate-pulse"
                  )}>
                    {(isExtracting || isAutoAdding) ? "유튜브 설명을 가져오는 중입니다..." : (summary || "동영상에 대한 설명이 여기에 표시됩니다.")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={cn("mt-6 space-y-6 transition-opacity", !metadata && !isExtracting && !isAutoAdding && "opacity-50 pointer-events-none select-none")}>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">요약</label>
            {(isExtracting || isAutoAdding) ? (
              <div className="w-full rounded-xl border border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 p-4 min-h-64 shadow-inner animate-pulse flex flex-col gap-2">
                 <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                 <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                 <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
                 <div className="mt-4 text-slate-400 dark:text-slate-500 text-sm italic">AI가 영상을 분석하여 요약 중입니다. 잠시만 기다려 주세요...</div>
              </div>
            ) : transcript ? (
              <div className="w-full rounded-xl border border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 p-4 prose dark:prose-invert prose-sm max-w-none shadow-inner break-words overflow-x-hidden">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  rehypePlugins={[rehypeRaw]}
                >
                  {he.decode(transcript || '')}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="w-full rounded-xl border border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-600 min-h-64 p-4 shadow-inner">
                요약 내용이 여기에 마크다운으로 표시됩니다.
              </div>
            )}
          </div>
        </section>

      </main>

      <BottomNav activeTab="youtube" />

      <div className="fixed bottom-[86px] left-0 right-0 p-4 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-t border-slate-100 dark:border-primary/10 z-20">
        <div className="max-w-2xl mx-auto flex justify-center">
          <button
            onClick={() => handleSave()}
            disabled={!title || isSaving}
            className="px-12 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-base rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xl">save</span>
            {isSaving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
