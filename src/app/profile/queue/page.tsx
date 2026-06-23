'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getDetailedQueueItems, deleteQueueItemAction, retryGeminiTaskAction } from '@/lib/db';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function QueuePage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const data = await getDetailedQueueItems();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchItems();
      const timer = setInterval(fetchItems, 10000); // Poll every 10 seconds
      return () => clearInterval(timer);
    }
  }, [status, router, fetchItems]);

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
      <Header title="AI 요약 작업 현황" />

      <main className="p-4 space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-6xl mb-4">task_alt</span>
            <p className="font-medium">진행 중인 작업이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">
              총 {items.length}개의 작업
            </p>
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
                    {item.status === 'failed' && (
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
                  <div className="col-span-2">
                    <span className="font-bold block text-slate-400 mb-0.5">프롬프트</span>
                    <p className="line-clamp-2 text-slate-700 dark:text-slate-200">
                      {item.payload.prompt || '기본 프롬프트'}
                    </p>
                  </div>
                  {item.error_message && (
                    <div className="col-span-2 bg-red-50 dark:bg-red-500/5 p-2 rounded-lg border border-red-100 dark:border-red-900/20 mt-1">
                      <span className="font-bold block text-red-500 mb-0.5">오류 메시지</span>
                      <p className="text-red-600 dark:text-red-400 break-all leading-relaxed">
                        {item.error_message}
                      </p>
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
                <li>제미나이 무료 티어 API 제한으로 인해 1분 간격으로 순차 처리됩니다.</li>
                <li>실패한 작업은 최대 3회까지 자동으로 재시도됩니다.</li>
                <li>지속적으로 실패하는 경우 모델이나 프롬프트 설정을 확인해 주세요.</li>
            </ul>
        </div>
      </main>

      <BottomNav activeTab="profile" />
    </div>
  );
}
