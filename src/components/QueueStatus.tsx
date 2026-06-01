'use client';

import { useEffect, useState, useCallback } from 'react';
import { getQueueItems, processNextQueueItemAction } from '@/lib/db';
import { cn } from '@/lib/utils';

export default function QueueStatus({ type }: { type?: 'youtube' | 'report' }) {
  const [queue, setQueue] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchQueue = useCallback(async () => {
    const items = await getQueueItems();
    setQueue(type ? items.filter(item => item.type === type) : items);

    // If there's something to process and we're not currently processing
    const hasWork = items.some(item => item.status === 'pending' || item.status === 'failed');
    if (hasWork && !isProcessing) {
        const processing = items.some(item => item.status === 'processing');
        if (!processing) {
            processQueue();
        }
    }
  }, [type, isProcessing]);

  const processQueue = async () => {
    setIsProcessing(true);
    try {
        await processNextQueueItemAction();
    } finally {
        setIsProcessing(false);
        fetchQueue();
    }
  };

  useEffect(() => {
    fetchQueue();
    const timer = setInterval(fetchQueue, 10000); // Poll every 10 seconds
    return () => clearInterval(timer);
  }, [fetchQueue]);

  if (queue.length === 0) return null;

  const pendingCount = queue.filter(i => i.status === 'pending' || i.status === 'failed').length;
  const processingItem = queue.find(i => i.status === 'processing');

  return (
    <div className="mb-6 bg-white dark:bg-slate-900/50 rounded-2xl border border-primary/10 p-4 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl animate-spin">sync</span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">AI 요약 작업 중</h3>
        </div>
        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {pendingCount + (processingItem ? 1 : 0)}개 대기 중
        </span>
      </div>

      <div className="space-y-2">
        {processingItem && (
          <div className="flex items-center gap-3 bg-primary/5 rounded-xl p-2.5 border border-primary/10">
            <div className="size-2 bg-primary rounded-full animate-pulse" />
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1">
              현재 처리 중: {processingItem.type === 'youtube' ? '유튜브 영상' : '리포트'}
            </p>
            <span className="text-[10px] text-primary font-bold">진행 중</span>
          </div>
        )}

        {queue.filter(i => i.status === 'pending' || i.status === 'failed').slice(0, 2).map((item) => (
          <div key={item.id} className="flex items-center gap-3 bg-slate-50 dark:bg-black/20 rounded-xl p-2.5 border border-slate-100 dark:border-primary/5 opacity-60">
            <div className="size-2 bg-slate-300 dark:bg-slate-700 rounded-full" />
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1">
              대기: {item.type === 'youtube' ? '유튜브 영상' : '리포트'}
            </p>
            {item.status === 'failed' && (
              <span className="text-[9px] text-red-500 font-bold">재시도 예정 ({item.retry_count})</span>
            )}
          </div>
        ))}

        {pendingCount > 2 && (
          <p className="text-[10px] text-slate-400 text-center pt-1">외 {pendingCount - 2}개의 작업이 더 있습니다.</p>
        )}
      </div>

      <p className="text-[9px] text-slate-400 mt-3 text-center">
        제미나이 무료 티어 제한으로 인해 1분 간격으로 순차 처리됩니다.
      </p>
    </div>
  );
}
