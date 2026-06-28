'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import {
  getDetailedQueueItems,
  deleteQueueItemAction,
  retryGeminiTaskAction,
  getQueueItems,
  processNextQueueItemAction,
  processQueueItemManuallyAction
} from '@/lib/db';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { showToast } from '@/components/Toast';

export default function QueuePage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedAt, setLastProcessedAt] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const modeRef = useRef<'auto' | 'manual'>('auto');

  // Load mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('queue_mode') as 'auto' | 'manual';
    if (savedMode) {
        setMode(savedMode);
        modeRef.current = savedMode;
    }
  }, []);

  const handleModeChange = (newMode: 'auto' | 'manual') => {
      setMode(newMode);
      modeRef.current = newMode;
      localStorage.setItem('queue_mode', newMode);
  };

  const fetchItems = useCallback(async () => {
    const [{ items: queueData, lastProcessedAt: last }, detailedData] = await Promise.all([
      getQueueItems(),
      getDetailedQueueItems()
    ]);

    setItems(detailedData);
    setLastProcessedAt(last);
    setLoading(false);

    // Trigger processing if needed and in auto mode
    if (modeRef.current === 'auto') {
        const hasWork = queueData.some((item: any) =>
            item.status === 'pending' ||
            item.status === 'failed' ||
            item.status === 'processing'
        );

        if (hasWork && !isProcessing) {
            processQueue();
        }
    }
  }, [isProcessing]);

  const processQueue = async () => {
    setIsProcessing(true);
    try {
        await processNextQueueItemAction();
    } finally {
        setIsProcessing(false);
        const data = await getDetailedQueueItems();
        setItems(data);
    }
  };

  const handleManualProcess = async (id: string) => {
      setIsProcessing(true);
      try {
          const res = await processQueueItemManuallyAction(id);
          if (!res.success) {
              alert(res.error || '작업 시작 실패');
          }
      } finally {
          setIsProcessing(false);
          fetchItems();
      }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchItems();
      const timer = setInterval(fetchItems, 10000);
      return () => clearInterval(timer);
    }
  }, [status, router, fetchItems]);

  // Elapsed timer logic
  useEffect(() => {
      const updateElapsed = () => {
          if (!lastProcessedAt) {
              setElapsedTime(0);
              return;
          }
          const last = new Date(lastProcessedAt).getTime();
          const now = Date.now();
          const diff = Math.floor((now - last) / 1000);
          setElapsedTime(Math.min(diff, 180)); // Cap at 3 minutes
      };

      updateElapsed();
      const timer = setInterval(updateElapsed, 1000);
      return () => clearInterval(timer);
  }, [lastProcessedAt]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 작업을 삭제하시겠습니까?')) return;
    const res = await deleteQueueItemAction(id);
    if (res.success) {
      fetchItems();
    } else {
      alert(res.error || '삭제 실패');
    }
  };

  const handleRetry = async (type: 'youtube' | 'report', targetId: string) => {
    const res = await retryGeminiTaskAction(type, targetId);
    if (res.success) {
      fetchItems();
    } else {
      alert(res.error || '재시도 실패');
    }
  };

  const handleCopyError = (msg: string) => {
      navigator.clipboard.writeText(msg).then(() => {
          showToast('오류 메시지가 복사되었습니다.');
      });
  };

  if (loading) {
    return (
      <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark">
        <Header title="AI 요약 작업 현황" />
        <main className="p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </main>
        <BottomNav activeTab="profile" />
      </div>
    );
  }

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="AI 요약 작업 현황"
        showBack
        rightAction={
            <button
                onClick={() => router.push('/settings/gemini')}
                className="size-10 flex items-center justify-center text-primary hover:bg-primary/5 rounded-full transition-colors"
                title="제미나이 설정"
            >
                <span className="material-symbols-outlined">settings_suggest</span>
            </button>
        }
      />

      <main className="p-4 space-y-6">
        {/* Mode & Timer Section */}
        <section className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">timer</span>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">마지막 작업 후</span>
                        <span className={cn(
                            "text-lg font-black leading-none",
                            elapsedTime >= 60 ? "text-primary" : "text-slate-700 dark:text-slate-200"
                        )}>
                            {elapsedTime}초 경과
                        </span>
                    </div>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => handleModeChange('auto')}
                        className={cn(
                            "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                            mode === 'auto' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500"
                        )}
                    >
                        자동
                    </button>
                    <button
                        onClick={() => handleModeChange('manual')}
                        className={cn(
                            "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                            mode === 'manual' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500"
                        )}
                    >
                        수동
                    </button>
                </div>
            </div>
            {mode === 'auto' && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-black/20 p-2.5 rounded-lg">
                    <span className="text-primary font-bold">자동 모드:</span> 제미나이 API 제한을 준수하기 위해 1분 간격으로 대기 중인 작업을 순차적으로 처리합니다.
                </p>
            )}
            {mode === 'manual' && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed bg-amber-50 dark:bg-amber-500/5 p-2.5 rounded-lg">
                    <span className="text-amber-600 font-bold">수동 모드:</span> 자동 처리가 중단됩니다. 각 작업의 <span className="font-bold">시작</span> 버튼을 눌러 즉시 실행할 수 있습니다. (잦은 호출 시 에러 발생 가능)
                </p>
            )}
        </section>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-20">task_alt</span>
            <p className="font-medium">진행 중인 작업이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Queue ({items.length})
                </p>
                {isProcessing && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-primary animate-pulse">
                        <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                        처리 중...
                    </span>
                )}
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm transition-all",
                  item.status === 'processing' ? "border-primary ring-1 ring-primary/20" :
                  item.status === 'failed' ? "border-red-200 dark:border-red-900/30" :
                  "border-slate-100 dark:border-primary/10"
                )}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                      item.type === 'youtube' ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                    )}>
                      {item.type}
                    </span>
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                      item.status === 'processing' ? "bg-primary text-white animate-pulse" :
                      item.status === 'failed' ? "bg-red-500 text-white" :
                      "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    )}>
                      {item.status === 'processing' ? '처리 중' :
                       item.status === 'failed' ? '실패' : '대기 중'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {(item.status === 'pending' || item.status === 'failed') && mode === 'manual' && (
                        <button
                            onClick={() => handleManualProcess(item.id)}
                            disabled={isProcessing}
                            className="h-8 px-3 flex items-center justify-center bg-primary text-white text-[11px] font-black rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                        >
                            시작
                        </button>
                    )}
                    {item.status === 'failed' && mode === 'auto' && (
                      <button
                        onClick={() => handleRetry(item.type, item.target_id)}
                        className="size-8 flex items-center justify-center bg-primary/10 text-primary rounded-full hover:bg-primary hover:text-white transition-colors"
                        title="재시도"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="size-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white transition-colors rounded-full"
                      title="삭제"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>

                <h4 className="font-bold text-sm mb-2 line-clamp-2 leading-snug">
                  {item.target_title || '제목 없음'}
                </h4>

                <div className="grid grid-cols-2 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-white/5 pt-3 mt-3">
                  <div>
                    <span className="font-bold block text-slate-400 mb-0.5">모델</span>
                    <span className="text-slate-700 dark:text-slate-200">{item.payload.model}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-slate-400 mb-0.5">요청 시간</span>
                    <span className="text-slate-700 dark:text-slate-200">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <span className="font-bold block text-slate-400">프롬프트</span>
                    <div className="max-h-24 overflow-y-auto bg-slate-50 dark:bg-black/20 p-2 rounded-lg border border-slate-100 dark:border-white/5 shadow-inner">
                        <p className="text-[10px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {item.payload.prompt || '기본 프롬프트'}
                        </p>
                    </div>
                  </div>
                  {item.error_message && (
                    <div className="col-span-2 mt-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold block text-red-500">오류 메시지 전체</span>
                        <button
                            onClick={() => handleCopyError(item.error_message)}
                            className="flex items-center gap-1 text-red-400 hover:text-red-600 transition-colors text-[10px] font-bold"
                        >
                            <span className="material-symbols-outlined text-[14px]">content_copy</span>
                            복사
                        </button>
                      </div>
                      <div className="max-h-32 overflow-y-auto bg-red-50 dark:bg-red-500/5 p-3 rounded-xl border border-red-100 dark:border-red-900/20 shadow-inner">
                        <p className="text-red-600 dark:text-red-400 break-words whitespace-pre-wrap leading-relaxed text-[10px]">
                            {item.error_message}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-4 border border-slate-100 dark:border-primary/5">
            <h5 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">info</span>
                안내사항
            </h5>
            <ul className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1 list-disc pl-4">
                <li>제미나이 무료 티어 API 제한으로 인해 자동 모드에서는 1분 간격으로 순차 처리됩니다.</li>
                <li>수동 모드에서는 제한 없이 즉시 시작할 수 있으나, 짧은 간격으로 실행 시 구글 정책에 따라 오류가 발생할 수 있습니다.</li>
                <li>실패한 작업은 최대 3회까지 자동으로 재시도됩니다.</li>
            </ul>
        </div>
      </main>

      <BottomNav activeTab="profile" />
    </div>
  );
}
