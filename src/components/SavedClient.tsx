'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState, memo, useMemo, useEffect } from 'react';
import { cn, formatDateToYMD, getLongPressHandlers } from '@/lib/utils';
import Link from 'next/link';
import { sendBatchEmailAction, deleteBlog, deleteYoutubeVideo, deleteReport } from '@/lib/db';
import { showToast } from '@/components/Toast';

export default function SavedClient({
  session,
  initialItems
}: {
  session: any;
  initialItems: any[];
}) {
  const [items, setItems] = useState<any[]>(initialItems);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{type: string, id: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'youtube' | 'blog' | 'report'>('all');

  useEffect(() => {
    const savedFilter = localStorage.getItem('saved_active_filter');
    if (savedFilter && ['all', 'youtube', 'blog', 'report'].includes(savedFilter)) {
        setActiveFilter(savedFilter as any);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('saved_active_filter', activeFilter);
  }, [activeFilter]);

  const filteredItems = useMemo(() => {
      if (activeFilter === 'all') return items;
      return items.filter(item => item.type === activeFilter);
  }, [items, activeFilter]);

  const toggleSelect = (type: string, id: string, e?: React.MouseEvent) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    setSelectedItems(prev => {
        const isAlreadySelected = prev.some(item => item.type === type && item.id === id);
        if (isAlreadySelected) {
            return prev.filter(item => !(item.type === type && item.id === id));
        } else {
            return [...prev, { type, id }];
        }
    });
  };

  const handleLongPress = (type: string, id: string) => {
    setIsEditMode(true);
    setSelectedItems([{ type, id }]);
  };

  const handleBatchEmail = async () => {
    if (selectedItems.length === 0) return;

    const email = localStorage.getItem('last_blog_email') || 'seokmin.kwon@samsung.com';

    setIsProcessing(true);
    try {
      const itemsToSend = selectedItems.map(item => ({
        type: item.type as 'youtube' | 'blog' | 'report',
        id: item.id
      }));
      const res = await sendBatchEmailAction(itemsToSend, email);
      if (res.success) {
        showToast('메일이 발송되었습니다.');
        setIsEditMode(false);
        setSelectedItems([]);
      } else {
        showToast(res.error || '발송 실패', 'error');
      }
    } catch (err: any) {
      showToast(`발송 실패: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
      if (selectedItems.length === 0) return;
      if (!confirm(`선택한 ${selectedItems.length}개의 항목을 삭제하시겠습니까?`)) return;

      setIsProcessing(true);
      try {
          let successCount = 0;
          for (const item of selectedItems) {
              let res;
              if (item.type === 'blog') res = await deleteBlog(item.id);
              else if (item.type === 'youtube') res = await deleteYoutubeVideo(item.id);
              else if (item.type === 'report') res = await deleteReport(item.id);

              if (res?.success) successCount++;
          }

          if (successCount > 0) {
              const selectedIds = selectedItems.map(si => si.id);
              setItems(prev => prev.filter(item => !selectedIds.includes(item.id)));
              showToast(`${successCount}개의 항목이 삭제되었습니다.`);
              setIsEditMode(false);
              setSelectedItems([]);
          } else {
              showToast('삭제에 실패했습니다.', 'error');
          }
      } catch (err) {
          console.error(err);
          showToast('삭제 중 오류가 발생했습니다.', 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  const isSelected = (type: string, id: string) => {
    return selectedItems.some(item => item.type === type && item.id === id);
  };

  const filters = [
      { id: 'all', label: '전체' },
      { id: 'youtube', label: 'YouTube' },
      { id: 'blog', label: '블로그' },
      { id: 'report', label: '리포트' }
  ];

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="저장된 항목"
        rightAction={
            isEditMode ? (
                <button
                    onClick={() => { setIsEditMode(false); setSelectedItems([]); }}
                    className="text-slate-500 font-bold px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg mr-2"
                >
                    취소
                </button>
            ) : (
                <button
                    onClick={() => window.location.href = '/add'}
                    className="text-primary p-2"
                    title="가져오기"
                >
                    <span className="material-symbols-outlined text-2xl">add_circle</span>
                </button>
            )
        }
      />

      <main className="mt-4 px-4">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-10 py-2">
            <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 py-1 flex-nowrap">
                {filters.map(f => (
                    <button
                        key={f.id}
                        onClick={() => setActiveFilter(f.id as any)}
                        className={cn(
                            "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                            activeFilter === f.id ? "bg-primary text-white shadow-md" : "bg-slate-200 dark:bg-black/30 text-slate-500 dark:text-slate-400"
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
        </div>

        {isEditMode && (
            <div className="mb-6 flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
                <p className="text-sm font-bold text-red-600 dark:text-red-400 ml-2">
                    {selectedItems.length}개 선택됨
                </p>
                <div className="flex gap-1.5">
                    <button
                        onClick={() => setSelectedItems(selectedItems.length === filteredItems.length ? [] : filteredItems.map(v => ({ type: v.type, id: v.id })))}
                        className="px-3 py-1.5 text-[10px] leading-tight font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                        {selectedItems.length === filteredItems.length ? <>전체<br/>해제</> : <>전체<br/>선택</>}
                    </button>
                    <button
                        onClick={handleBatchEmail}
                        disabled={selectedItems.length === 0 || isProcessing}
                        className="px-3 py-1.5 text-[10px] leading-tight font-bold bg-primary text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[56px]"
                    >
                        {isProcessing ? (
                            <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>메일<br/>발송</>
                        )}
                    </button>
                    <button
                        onClick={handleBatchDelete}
                        disabled={selectedItems.length === 0 || isProcessing}
                        className="px-3 py-1.5 text-[10px] leading-tight font-bold bg-red-500 text-white rounded-lg shadow-sm disabled:opacity-50"
                    >
                        삭제
                    </button>
                </div>
            </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="py-20 text-center text-slate-400">저장된 항목이 없습니다.</div>
        ) : (
          <div className="space-y-3 pb-20">
            {filteredItems.map((item) => (
              <SavedItem
                key={`${item.type}-${item.id}`}
                item={item}
                isEditMode={isEditMode}
                isSelected={isSelected(item.type, item.id)}
                onLongPress={handleLongPress}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav activeTab="saved" />
    </div>
  );
}

const SavedItem = memo(({ item, isEditMode, isSelected, onLongPress, onToggleSelect }: any) => {
  let href = '';
  let icon = '';
  let iconColor = '';
  let typeLabel = '';

  if (item.type === 'youtube') {
    href = `/youtube/${item.id}`;
    icon = 'video_library';
    iconColor = 'text-red-500 bg-red-50 dark:bg-red-500/10';
    typeLabel = 'YouTube';
  } else if (item.type === 'blog') {
    href = `/blog/${item.id}`;
    icon = 'rss_feed';
    iconColor = 'text-green-500 bg-green-50 dark:bg-green-500/10';
    typeLabel = '블로그';
  } else if (item.type === 'report') {
    href = `/report?id=${item.id}`;
    icon = 'description';
    iconColor = 'text-blue-500 bg-blue-50 dark:bg-blue-500/10';
    typeLabel = '리포트';
  }

  const longPressHandlers = getLongPressHandlers(() => onLongPress(item.type, item.id), 500);

  return (
    <div className="relative animate-fade-in-up">
      <Link
        href={isEditMode ? '#' : href}
        onClick={(e) => isEditMode && onToggleSelect(item.type, item.id, e)}
        onContextMenu={(e) => e.preventDefault()}
        {...longPressHandlers}
        className={cn(
          "flex items-center gap-3 bg-white dark:bg-slate-900/50 rounded-2xl border overflow-hidden shadow-sm active:scale-[0.98] transition-all relative group",
          isEditMode && isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-100 dark:border-primary/10"
        )}
      >
        {item.type === 'youtube' && item.thumbnail ? (
          <div className="relative shrink-0 w-24 aspect-video rounded-lg overflow-hidden border border-slate-100 dark:border-primary/5">
            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] font-bold px-1 rounded">
                {item.duration}
            </div>
          </div>
        ) : (
          <div className={cn("size-12 shrink-0 rounded-xl flex items-center justify-center ml-3", iconColor)}>
            <span className="material-symbols-outlined">{icon}</span>
          </div>
        )}

        <div className="flex-1 min-w-0 py-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase",
                item.type === 'youtube' ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                item.type === 'blog' ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            )}>
                {typeLabel}
            </span>
            <span className="text-[10px] text-slate-400">{formatDateToYMD(item.added_at)}</span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-1 leading-tight">
            {item.title}
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {item.author || item.institution || ''}
          </p>
        </div>

        <div className="flex items-center pr-3">
            {isEditMode ? (
                <div className={cn(
                    "size-5 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected ? "bg-primary border-primary" : "border-slate-200 dark:border-slate-700"
                )}>
                    {isSelected && <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>}
                </div>
            ) : (
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-sm">chevron_right</span>
            )}
        </div>
      </Link>
    </div>
  );
});
