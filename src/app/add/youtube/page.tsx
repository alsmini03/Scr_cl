'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState, useEffect } from 'react';
import { saveYoutubeVideo } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

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
  const [summary, setSummary] = useState('');
  const [transcript, setTranscript] = useState('');

  // Gemini Models
  const [models, setModels] = useState<string[]>(['gemini-2.5-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-3-flash-preview']);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-lite');
  const [newModelName, setNewModelName] = useState('');
  const [showModelManager, setShowModelManager] = useState(false);

  // Prompts
  const defaultPrompt = `📊 영상 종합 분석 리포트

📌 제목: [영상 제목]
출처: [URL]
⏱️ 영상 길이: [00:00]
🗓️ 업로드 날짜: [YYYY.MM.DD]

🎯 핵심 요약
[영상의 핵심 메시지와 주요 가치를 3-5줄로 응축하여 인용구 형태로 제시]

🔑 주요 인사이트
[첫 번째 인사이트] [00:00]
세부 설명과 의미
실용적 적용점

📚 세부 내용 분석
🔖 [섹션 1 제목] [00:00]
[하위 주제 1]: 핵심 정보
💡 인사이트: [관련 인사이트 강조]

📈 데이터 및 통계
[주요 수치 정보를 표 형태로 제시]

🚀 실천 액션 플랜
즉시 실행: [구체적 행동 제안]`;

  const [prompts, setPrompts] = useState<{name: string, text: string}[]>([
    { name: '종합 분석 리포트', text: defaultPrompt },
    { name: '3줄 요약', text: '영상의 내용을 3줄로 요약해 주세요.' }
  ]);
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptText, setNewPromptText] = useState('');
  const [showPromptManager, setShowPromptManager] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const savedModels = localStorage.getItem('gemini-models');
    if (savedModels) {
      try {
        const parsed = JSON.parse(savedModels);
        if (Array.isArray(parsed) && parsed.length > 0) setModels(parsed);
      } catch (e) {}
    }

    const savedPrompts = localStorage.getItem('gemini-prompts');
    if (savedPrompts) {
      try {
        const parsed = JSON.parse(savedPrompts);
        if (Array.isArray(parsed) && parsed.length > 0) setPrompts(parsed);
      } catch (e) {}
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('gemini-models', JSON.stringify(models));
  }, [models]);

  useEffect(() => {
    localStorage.setItem('gemini-prompts', JSON.stringify(prompts));
  }, [prompts]);

  const addModel = () => {
    if (newModelName && !models.includes(newModelName)) {
      setModels([...models, newModelName]);
      setNewModelName('');
    }
  };

  const deleteModel = (modelToDelete: string) => {
    if (models.length > 1) {
      const updatedModels = models.filter(m => m !== modelToDelete);
      setModels(updatedModels);
      if (selectedModel === modelToDelete) setSelectedModel(updatedModels[0]);
    }
  };

  const addPrompt = () => {
    if (newPromptName && newPromptText) {
      setPrompts([...prompts, { name: newPromptName, text: newPromptText }]);
      setNewPromptName('');
      setNewPromptText('');
    }
  };

  const deletePrompt = (index: number) => {
    if (prompts.length > 1) {
      const updated = prompts.filter((_, i) => i !== index);
      setPrompts(updated);
      if (selectedPromptIndex >= updated.length) setSelectedPromptIndex(0);
    }
  };

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
        body: JSON.stringify({
          url,
          model: selectedModel,
          prompt: prompts[selectedPromptIndex].text
        }),
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

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 pb-80">
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

        <section className="mb-10 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 ml-1">제미나이 모델</label>
                <div className="flex gap-2">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="flex-1 rounded-xl border border-primary/20 bg-white text-slate-900 h-14 px-4 outline-none appearance-none"
                  >
                    {models.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowModelManager(!showModelManager)}
                    className="bg-slate-100 text-slate-600 px-4 rounded-xl flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-sm">{showModelManager ? 'close' : 'settings'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 ml-1">분석 프롬프트</label>
                <div className="flex gap-2">
                  <select
                    value={selectedPromptIndex}
                    onChange={(e) => setSelectedPromptIndex(parseInt(e.target.value))}
                    className="flex-1 rounded-xl border border-primary/20 bg-white text-slate-900 h-14 px-4 outline-none appearance-none"
                  >
                    {prompts.map((p, i) => (
                      <option key={i} value={i}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowPromptManager(!showPromptManager)}
                    className="bg-slate-100 text-slate-600 px-4 rounded-xl flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-sm">{showPromptManager ? 'close' : 'terminal'}</span>
                  </button>
                </div>
              </div>
            </div>

            {showModelManager && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">모델 추가</label>
                  <div className="flex gap-2">
                    <input type="text" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="모델명 (예: gemini-pro)" className="flex-1 rounded-lg border p-2 text-sm" />
                    <button onClick={addModel} className="bg-primary text-white px-4 rounded-lg text-sm">추가</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {models.map(m => (
                    <div key={m} className="flex items-center gap-1 bg-white border px-2 py-1 rounded-full text-xs">
                      <span>{m}</span>
                      <button onClick={() => deleteModel(m)} className="text-red-400"><span className="material-symbols-outlined text-xs">cancel</span></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showPromptManager && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">프롬프트 추가</label>
                  <input type="text" value={newPromptName} onChange={(e) => setNewPromptName(e.target.value)} placeholder="프롬프트 이름" className="rounded-lg border p-2 text-sm" />
                  <textarea value={newPromptText} onChange={(e) => setNewPromptText(e.target.value)} placeholder="프롬프트 내용" className="rounded-lg border p-2 text-sm h-24" />
                  <button onClick={addPrompt} className="bg-primary text-white py-2 rounded-lg text-sm font-bold">프롬프트 저장</button>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">저장된 프롬프트</label>
                  <div className="space-y-2">
                    {prompts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border p-3 rounded-xl">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">{p.name}</span>
                          <span className="text-xs text-slate-400 truncate max-w-[200px]">{p.text}</span>
                        </div>
                        <button onClick={() => deletePrompt(i)} className="text-red-400"><span className="material-symbols-outlined">delete</span></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
              <div className="w-full aspect-video bg-slate-100 rounded-xl flex flex-col items-center justify-center shrink-0 border border-slate-200 overflow-hidden shadow-sm relative group">
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

      </main>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 z-50">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSave}
            disabled={!title || isSaving}
            className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">save</span>
            {isSaving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
