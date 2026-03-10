'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState, useEffect } from 'react';
import {
  saveYoutubeVideo,
  getGeminiModels,
  addGeminiModel,
  updateGeminiModel,
  deleteGeminiModel,
  setDefaultGeminiModel,
  getGeminiPrompts,
  addGeminiPrompt,
  updateGeminiPrompt,
  deleteGeminiPrompt,
  setDefaultGeminiPrompt
} from '@/lib/db';
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
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [showModelManager, setShowModelManager] = useState(false);

  // Prompts
  const [prompts, setPrompts] = useState<any[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptText, setNewPromptText] = useState('');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [showPromptManager, setShowPromptManager] = useState(false);

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

  const handleAddModel = async () => {
    if (newModelName) {
      let res;
      if (editingModelId) {
        res = await updateGeminiModel(editingModelId, newModelName);
      } else {
        res = await addGeminiModel(newModelName);
      }

      if (res.success) {
        setNewModelName('');
        setEditingModelId(null);
        await loadSettings();
      } else {
        alert(res.error);
      }
    }
  };

  const startEditModel = (model: any) => {
    setEditingModelId(model.id);
    setNewModelName(model.name);
  };

  const handleDeleteModel = async (id: string) => {
    const res = await deleteGeminiModel(id);
    if (res.success) {
      await loadSettings();
    }
  };

  const handleSetDefaultModel = async (id: string) => {
    const res = await setDefaultGeminiModel(id);
    if (res.success) {
      await loadSettings();
    }
  };

  const handleAddPrompt = async () => {
    if (newPromptName && newPromptText) {
      let res;
      if (editingPromptId) {
        res = await updateGeminiPrompt(editingPromptId, newPromptName, newPromptText);
      } else {
        res = await addGeminiPrompt(newPromptName, newPromptText);
      }

      if (res.success) {
        setNewPromptName('');
        setNewPromptText('');
        setEditingPromptId(null);
        await loadSettings();
      } else {
        alert(res.error);
      }
    }
  };

  const startEditPrompt = (prompt: any) => {
    setEditingPromptId(prompt.id);
    setNewPromptName(prompt.name);
    setNewPromptText(prompt.content);
  };

  const handleDeletePrompt = async (id: string) => {
    const res = await deleteGeminiPrompt(id);
    if (res.success) {
      await loadSettings();
    }
  };

  const handleSetDefaultPrompt = async (id: string) => {
    const res = await setDefaultGeminiPrompt(id);
    if (res.success) {
      await loadSettings();
    }
  };

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

      // Update state locally for UI feedback (optional but helpful)
      setMetadata({ ...data, url });
      setTitle(data.title || '');
      setSummary(data.description || '');
      setTranscript(data.summary || '');
      setDuration(data.duration || '00:00');
      const pubAt = data.publishDate || new Date().toISOString().split('T')[0];
      setPublishedAt(pubAt);

      // Immediately save
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
    } catch (err: any) {
      console.error('Auto Add error:', err);
      setError(err.message || '자동 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAutoAdding(false);
    }
  };

  return (
    <div className="font-display min-h-screen flex flex-col bg-white">
      <Header title="유튜브" showBack />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 pb-48">
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
                      <option key={model.id} value={model.name}>{model.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowModelManager(!showModelManager)}
                    className="bg-slate-100 text-slate-600 px-4 rounded-xl flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-sm">{showModelManager ? 'close' : 'settings'}</span>
                  </button>
                </div>

                {showModelManager && (
                  <div className="mt-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        {editingModelId ? '모델 수정' : '모델 추가'}
                      </label>
                      <div className="flex gap-2">
                        <input type="text" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="모델명 (예: gemini-pro)" className="flex-1 rounded-lg border p-2 text-sm" />
                        <button onClick={handleAddModel} className="bg-primary text-white px-4 rounded-lg text-sm">
                          {editingModelId ? '수정' : '추가'}
                        </button>
                        {editingModelId && (
                          <button onClick={() => { setEditingModelId(null); setNewModelName(''); }} className="bg-slate-200 text-slate-600 px-3 rounded-lg text-sm">취소</button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {models.map(m => (
                        <div key={m.id} className={cn(
                          "flex items-center gap-2 border px-3 py-1.5 rounded-full text-xs transition-colors",
                          m.is_default ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200"
                        )}>
                          <button onClick={() => handleSetDefaultModel(m.id)} className="font-medium hover:underline">{m.name}</button>
                          <button onClick={() => startEditModel(m)} className="opacity-60 hover:opacity-100"><span className="material-symbols-outlined text-[14px]">edit</span></button>
                          <button onClick={() => handleDeleteModel(m.id)} className={cn(
                            "hover:text-red-500 flex items-center",
                            m.is_default ? "text-white/70" : "text-slate-400"
                          )}>
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 ml-1">분석 프롬프트</label>
                <div className="flex gap-2">
                  <select
                    value={selectedPromptId}
                    onChange={(e) => setSelectedPromptId(e.target.value)}
                    className="flex-1 rounded-xl border border-primary/20 bg-white text-slate-900 h-14 px-4 outline-none appearance-none"
                  >
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowPromptManager(!showPromptManager)}
                    className="bg-slate-100 text-slate-600 px-4 rounded-xl flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-sm">{showPromptManager ? 'close' : 'terminal'}</span>
                  </button>
                </div>

                {showPromptManager && (
                  <div className="mt-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        {editingPromptId ? '프롬프트 수정' : '프롬프트 추가'}
                      </label>
                      <input type="text" value={newPromptName} onChange={(e) => setNewPromptName(e.target.value)} placeholder="프롬프트 이름" className="rounded-lg border p-2 text-sm" />
                      <textarea value={newPromptText} onChange={(e) => setNewPromptText(e.target.value)} placeholder="프롬프트 내용" className="rounded-lg border p-2 text-sm h-24" />
                      <div className="flex gap-2">
                        <button onClick={handleAddPrompt} className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-bold">
                          {editingPromptId ? '프롬프트 수정 저장' : '프롬프트 저장'}
                        </button>
                        {editingPromptId && (
                           <button onClick={() => { setEditingPromptId(null); setNewPromptName(''); setNewPromptText(''); }} className="bg-slate-200 text-slate-600 px-4 rounded-lg text-sm">취소</button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">저장된 프롬프트</label>
                      <div className="space-y-2">
                        {prompts.map((p) => (
                          <div key={p.id} className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-colors",
                            p.is_default ? "bg-primary/5 border-primary/20" : "bg-white border-slate-200"
                          )}>
                            <button
                              onClick={() => handleSetDefaultPrompt(p.id)}
                              className="flex flex-col flex-1 text-left"
                            >
                              <span className={cn("text-sm font-bold", p.is_default ? "text-primary" : "text-slate-900")}>
                                {p.name} {p.is_default && " (기본값)"}
                              </span>
                              <span className="text-xs text-slate-400 truncate max-w-[200px]">{p.content}</span>
                            </button>
                            <div className="flex items-center gap-1">
                              <button onClick={() => startEditPrompt(p)} className="text-slate-400 hover:text-primary p-1">
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button onClick={() => handleDeletePrompt(p.id)} className="text-slate-400 hover:text-red-500 p-1">
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 ml-1">유튜브 영상 URL</label>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-xl border border-primary/20 bg-white text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 transition-all outline-none"
                  placeholder="https://www.youtube.com/.."
                />
                <div className="flex gap-2">
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

        {/* Preview State - Vertical Layout for YouTube */}
        <section className="border-t border-primary/10 pt-6">
          <div className={cn("mt-4 transition-opacity", !metadata && !isExtracting && !isAutoAdding && "opacity-50 pointer-events-none select-none")}>
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
                {(isExtracting || isAutoAdding) && <div className="absolute inset-0 bg-white/50 animate-pulse flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span></div>}
              </div>

              {/* Metadata - Below Thumbnail */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">제목</label>
                  <div className={cn(
                    "min-h-12 bg-slate-50 rounded-xl px-4 py-3 flex items-center text-sm font-medium text-slate-900 border border-slate-100 shadow-inner break-words",
                    (isExtracting || isAutoAdding) && "animate-pulse"
                  )}>
                    {(isExtracting || isAutoAdding) ? "가져오는 중..." : (title || "영상 제목")}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">재생 시간</label>
                    <div className={cn(
                      "h-12 bg-slate-50 rounded-xl px-4 flex items-center text-sm text-slate-900 border border-slate-100 shadow-inner",
                      (isExtracting || isAutoAdding) && "animate-pulse"
                    )}>
                      {(isExtracting || isAutoAdding) ? "--:--" : (duration || "00:00")}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">등록일자</label>
                    <div className={cn(
                      "h-12 bg-slate-50 rounded-xl px-4 flex items-center text-sm text-slate-900 border border-slate-100 shadow-inner",
                      (isExtracting || isAutoAdding) && "animate-pulse"
                    )}>
                      {(isExtracting || isAutoAdding) ? "YYYY-MM-DD" : (publishedAt || "2024-01-01")}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">설명</label>
                  <div className={cn(
                    "min-h-32 bg-slate-50 rounded-xl p-4 text-sm text-slate-900 border border-slate-100 shadow-inner whitespace-pre-wrap overflow-hidden",
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
            <label className="text-sm font-bold text-slate-700 ml-1">요약</label>
            {(isExtracting || isAutoAdding) ? (
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

      {/* Fixed Bottom Action Bar - above BottomNav */}
      <div className="fixed bottom-[88px] left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 z-20">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => handleSave()}
            disabled={!title || isSaving}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-bold text-base rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xl">save</span>
            {isSaving ? '저장 중...' : '내 서재에 저장하기'}
          </button>
        </div>
      </div>

      <BottomNav activeTab="home" />
    </div>
  );
}
