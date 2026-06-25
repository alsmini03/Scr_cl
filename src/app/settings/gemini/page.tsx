'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState, useEffect } from 'react';
import {
  getGeminiModels,
  addGeminiModel,
  updateGeminiModel,
  deleteGeminiModel,
  setDefaultGeminiModel,
  getGeminiPrompts,
  addGeminiPrompt,
  updateGeminiPrompt,
  deleteGeminiPrompt,
  setDefaultGeminiPrompt,
  getGeminiKeyPreference,
  updateGeminiKeyPreferenceAction
} from '@/lib/db';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/Toast';

interface GeminiModel {
  id: string;
  name: string;
  youtube_default: boolean;
  report_default: boolean;
}

interface GeminiPrompt {
  id: string;
  name: string;
  content: string;
  youtube_default: boolean;
  report_default: boolean;
}

export default function GeminiSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'youtube' | 'report'>('youtube');
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [newModelName, setNewModelName] = useState('');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  const [prompts, setPrompts] = useState<GeminiPrompt[]>([]);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptText, setNewPromptText] = useState('');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  const [keyPreference, setKeyPreference] = useState<number>(1);

  const loadSettings = async () => {
    const [dbModels, dbPrompts, dbKeyPref] = await Promise.all([
      getGeminiModels(),
      getGeminiPrompts(),
      getGeminiKeyPreference()
    ]);
    setModels(dbModels);
    setPrompts(dbPrompts);
    setKeyPreference(dbKeyPref);
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
        showToast(editingModelId ? '모델이 수정되었습니다.' : '모델이 추가되었습니다.');
      } else {
        showToast(res.error || '실패', 'error');
      }
    }
  };

  const startEditModel = (model: GeminiModel) => {
    setEditingModelId(model.id);
    setNewModelName(model.name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteModel = async (id: string) => {
    if (!confirm('모델을 삭제하시겠습니까?')) return;
    const res = await deleteGeminiModel(id);
    if (res.success) {
      await loadSettings();
    }
  };

  const handleSetDefaultModel = async (id: string) => {
    const res = await setDefaultGeminiModel(id, activeTab);
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
        showToast(editingPromptId ? '프롬프트가 수정되었습니다.' : '프롬프트가 추가되었습니다.');
      } else {
        showToast(res.error || '실패', 'error');
      }
    }
  };

  const startEditPrompt = (prompt: GeminiPrompt) => {
    setEditingPromptId(prompt.id);
    setNewPromptName(prompt.name);
    setNewPromptText(prompt.content);
    // Scroll to prompt editor
    const el = document.getElementById('prompt-editor');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm('프롬프트를 삭제하시겠습니까?')) return;
    const res = await deleteGeminiPrompt(id);
    if (res.success) {
      await loadSettings();
    }
  };

  const handleSetDefaultPrompt = async (id: string) => {
    const res = await setDefaultGeminiPrompt(id, activeTab);
    if (res.success) {
      await loadSettings();
    }
  };

  const handleSetKeyPreference = async (index: number) => {
      const res = await updateGeminiKeyPreferenceAction(index);
      if (res.success) {
          setKeyPreference(index);
          showToast(`API 키 ${index}번이 선택되었습니다.`);
      }
  };

  return (
    <div className="font-display min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 pb-24">
      <Header title="Gemini 설정" showBack />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-10">

        {/* API Key Preference Section */}
        <section className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">key</span>
                API 키 선택
            </h2>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-primary/10 shadow-sm space-y-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => handleSetKeyPreference(1)}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-2",
                            keyPreference === 1
                                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                : "bg-slate-50 dark:bg-black/20 text-slate-500 border-slate-100 dark:border-primary/5 hover:border-primary/30"
                        )}
                    >
                        <span className="material-symbols-outlined text-3xl">filter_1</span>
                        <span className="text-sm font-black tracking-tight">API 키 1번</span>
                        <span className="text-[10px] opacity-60">기본 키 사용</span>
                    </button>
                    <button
                        onClick={() => handleSetKeyPreference(2)}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-2",
                            keyPreference === 2
                                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                : "bg-slate-50 dark:bg-black/20 text-slate-500 border-slate-100 dark:border-primary/5 hover:border-primary/30"
                        )}
                    >
                        <span className="material-symbols-outlined text-3xl">filter_2</span>
                        <span className="text-sm font-black tracking-tight">API 키 2번</span>
                        <span className="text-[10px] opacity-60">보조 키 사용</span>
                    </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center bg-slate-50 dark:bg-black/10 py-2 rounded-lg">
                    무료 할당량 소진 시 다른 키로 전환하여 사용할 수 있습니다.
                </p>
            </div>
        </section>

        {/* Tab Picker */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-primary/10">
            <button
                onClick={() => setActiveTab('youtube')}
                className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                    activeTab === 'youtube' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
            >
                <span className="material-symbols-outlined text-lg">smart_display</span>
                유튜브 디폴트 설정
            </button>
            <button
                onClick={() => setActiveTab('report')}
                className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                    activeTab === 'report' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
            >
                <span className="material-symbols-outlined text-lg">description</span>
                리포트
            </button>
        </div>

        {/* Model Section */}
        <section className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">robot_2</span>
                모델 관리
            </h2>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-primary/10 shadow-sm space-y-4">
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                        {editingModelId ? '모델 수정' : '새 모델 추가'}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newModelName}
                            onChange={(e) => setNewModelName(e.target.value)}
                            placeholder="모델명 (예: gemini-1.5-pro)"
                            className="flex-1 rounded-xl border border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-black/20 p-3 text-sm outline-none focus:border-primary transition-colors"
                        />
                        <button
                            onClick={handleAddModel}
                            disabled={!newModelName}
                            className="bg-primary text-white px-5 rounded-xl text-sm font-bold disabled:opacity-50"
                        >
                            {editingModelId ? '수정' : '추가'}
                        </button>
                        {editingModelId && (
                            <button onClick={() => { setEditingModelId(null); setNewModelName(''); }} className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-4 rounded-xl text-sm font-bold">취소</button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                    {models.map(m => {
                        const isDefault = activeTab === 'report' ? m.report_default : m.youtube_default;
                        return (
                        <div key={m.id} className={cn(
                            "flex items-center gap-2 border px-4 py-2 rounded-full text-sm transition-all",
                            isDefault ? "bg-primary text-white border-primary shadow-md" : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-primary/10"
                        )}>
                            <button onClick={() => handleSetDefaultModel(m.id)} className="font-bold hover:underline">{m.name}</button>
                            <div className="w-px h-3 bg-current opacity-20 mx-1"></div>
                            <button onClick={() => startEditModel(m)} className="opacity-60 hover:opacity-100"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                            <button onClick={() => handleDeleteModel(m.id)} className={cn(
                                "hover:text-red-500 flex items-center",
                                isDefault ? "text-white/70" : "text-slate-400"
                            )}>
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                    )})}
                </div>
            </div>
        </section>

        {/* Prompt Section */}
        <section className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">terminal</span>
                분석 프롬프트 관리
            </h2>

            <div id="prompt-editor" className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-primary/10 shadow-sm space-y-4">
                <div className="flex flex-col gap-3">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                        {editingPromptId ? '프롬프트 수정' : '새 프롬프트 추가'}
                    </label>
                    <input
                        type="text"
                        value={newPromptName}
                        onChange={(e) => setNewPromptName(e.target.value)}
                        placeholder="프롬프트 이름 (예: 영상 요약)"
                        className="rounded-xl border border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-black/20 p-3 text-sm outline-none focus:border-primary transition-colors"
                    />
                    <textarea
                        value={newPromptText}
                        onChange={(e) => setNewPromptText(e.target.value)}
                        placeholder="프롬프트 내용을 입력하세요. (AI에게 전달될 지시사항)"
                        className="rounded-xl border border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-black/20 p-3 text-sm outline-none focus:border-primary transition-colors h-40 resize-none"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleAddPrompt}
                            disabled={!newPromptName || !newPromptText}
                            className="flex-1 bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            {editingPromptId ? '프롬프트 수정 저장' : '프롬프트 저장'}
                        </button>
                        {editingPromptId && (
                            <button onClick={() => { setEditingPromptId(null); setNewPromptName(''); setNewPromptText(''); }} className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-6 rounded-xl text-sm font-bold">취소</button>
                        )}
                    </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-50 dark:border-primary/5">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">저장된 프롬프트 목록</label>
                    <div className="grid gap-3">
                        {prompts.map((p) => {
                            const isDefault = activeTab === 'report' ? p.report_default : p.youtube_default;
                            return (
                            <div key={p.id} className={cn(
                                "group relative p-4 rounded-2xl border transition-all",
                                isDefault ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10" : "bg-slate-50 dark:bg-black/10 border-slate-100 dark:border-primary/5"
                            )}>
                                <div className="flex justify-between items-start mb-2">
                                    <button
                                        onClick={() => handleSetDefaultPrompt(p.id)}
                                        className="text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={cn("text-sm font-bold", isDefault ? "text-primary" : "text-slate-900 dark:text-slate-100")}>
                                                {p.name}
                                            </span>
                                            {isDefault && (
                                                <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded font-bold">DEFAULT</span>
                                            )}
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => startEditPrompt(p)} className="text-slate-400 hover:text-primary p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                        </button>
                                        <button onClick={() => handleDeletePrompt(p.id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                                    {p.content}
                                </p>
                            </div>
                        )})}
                        {prompts.length === 0 && (
                            <div className="py-10 text-center text-slate-400 text-sm italic">저장된 프롬프트가 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>
        </section>

      </main>

      <BottomNav activeTab="profile" />
    </div>
  );
}
