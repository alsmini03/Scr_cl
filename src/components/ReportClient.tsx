'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, memo, useRef } from 'react';
import { addReportTab, deleteReportTab, updateReportTabOrder } from '@/lib/db';
import { cn } from '@/lib/utils';
import TabManagementModal from '@/components/TabManagementModal';

interface Report {
  id: string;
  index: string;
  date: string;
  title: string;
  author: string;
  institution: string;
  fileId?: string;
  fileNum?: string;
  hasFile: boolean;
  fileSize?: string;
}

export default function ReportClient({
  session,
  initialTabs,
}: {
  session: any;
  initialTabs: any[];
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [tabs, setTabs] = useState<any[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showTabManager, setShowTabManager] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [lastId, setLastId] = useState('0');
  const [hasMore, setHasMore] = useState(true);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedTab = localStorage.getItem('report_active_tab');
    if (savedTab && tabs.some(t => t.id === savedTab)) {
        setActiveTabId(savedTab);
    } else if (tabs.length > 0) {
        setActiveTabId(tabs[0].id);
    } else {
        setActiveTabId('default');
    }
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
        localStorage.setItem('report_active_tab', activeTabId);
        fetchReports(true);
    }
  }, [activeTabId]);

  const fetchReports = async (isInitial = false) => {
    if (isInitial) {
        setIsLoading(true);
        setReports([]);
        setLastId('0');
        setHasMore(true);
    } else {
        if (!hasMore || isMoreLoading) return;
        setIsMoreLoading(true);
    }

    try {
      const activeTab = tabs.find(t => t.id === activeTabId);
      const url = activeTab?.url || 'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/AjaxPrimeListHotClickSub.asp';

      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url,
            lstNumO: isInitial ? '0' : lastId,
            actNum: isInitial ? '0' : '2'
        })
      });

      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length === 0) {
            setHasMore(false);
        } else {
            if (isInitial) {
              setReports(data);
            } else {
              setReports(prev => [...prev, ...data]);
            }
            setLastId(data[data.length - 1].index);
        }
      } else {
          setHasMore(false);
      }
    } catch (err) {
      console.error(err);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsMoreLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading || isMoreLoading || !hasMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        fetchReports(false);
      }
    });

    if (lastElementRef.current) {
      observer.current.observe(lastElementRef.current);
    }
  }, [reports, isLoading, isMoreLoading, hasMore]);

  const handleDownload = async (report: Report) => {
    if (!report.fileId || !report.fileNum) return;

    try {
        const res = await fetch('/api/report/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                number: report.fileId,
                gn: report.fileNum,
                title: report.title
            })
        });

        if (!res.ok) throw new Error('Download failed');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = report.title + '.pdf';
        if (contentDisposition && contentDisposition.includes('filename*=')) {
            const parts = contentDisposition.split("filename* = UTF-8''");
            if (parts.length > 1) {
                filename = decodeURIComponent(parts[1]);
            }
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download error:', error);
        alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleAddTab = async () => {
    if (!newTabName || !newTabUrl) return;
    setIsAddingTab(true);
    const res = await addReportTab(newTabName, newTabUrl);
    if (res.success && res.id) {
      setNewTabName('');
      setNewTabUrl('');
      setTabs(prev => [...prev, { id: res.id, name: newTabName, url: newTabUrl }]);
      setActiveTabId(res.id);
      setShowTabManager(false);
    } else {
      alert(res.error);
    }
    setIsAddingTab(false);
  };

  const handleDeleteTab = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('탭을 삭제하시겠습니까?')) return;
    const res = await deleteReportTab(id);
    if (res.success) {
      if (activeTabId === id) setActiveTabId(tabs.find(t => t.id !== id)?.id || 'default');
      setTabs(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleTabLongPress = (id: string) => {
    setIsModalOpen(true);
  };

  const moveTab = (draggedId: string, hoverId: string) => {
    const draggedIndex = tabs.findIndex(t => t.id === draggedId);
    const hoverIndex = tabs.findIndex(t => t.id === hoverId);
    const newTabs = [...tabs];
    const [draggedTab] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(hoverIndex, 0, draggedTab);
    setTabs(newTabs);
  };

  const saveTabOrder = async () => {
    const orders = tabs.map((tab, index) => ({ id: tab.id, position: index }));
    const res = await updateReportTabOrder(orders);
    if (!res.success) {
      alert(res.error);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="리포트"
        transparent
        rightAction={
          <button
            onClick={() => setShowTabManager(!showTabManager)}
            className="text-primary p-2"
          >
            <span className="material-symbols-outlined text-2xl">{showTabManager ? 'close' : 'add_circle'}</span>
          </button>
        }
      />

      <main className="mt-4 px-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-10">
          <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 py-2">
            <button
                onClick={() => setActiveTabId('default')}
                className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                    activeTabId === 'default' ? "bg-primary text-white shadow-md" : "bg-slate-200 dark:bg-black/30 text-slate-500 dark:text-slate-400"
                )}
            >
                전체리포트
            </button>
            {tabs.map(tab => {
                let timer: any;
                const handleTouchStart = () => { timer = setTimeout(() => handleTabLongPress(tab.id), 600); };
                const handleTouchEnd = () => { clearTimeout(timer); };
                return (
                    <div
                        key={tab.id}
                        className="relative flex-shrink-0 group transition-all"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={handleTouchStart}
                        onMouseUp={handleTouchEnd}
                    >
                        <button
                            onClick={() => setActiveTabId(tab.id)}
                            className={cn(
                                "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                                activeTabId === tab.id ? "bg-primary text-white shadow-md" : "bg-slate-200 dark:bg-black/30 text-slate-500 dark:text-slate-400"
                            )}
                        >
                            {tab.name}
                        </button>
                    </div>
                );
            })}
          </div>
        </div>

        {showTabManager && (
          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 space-y-3">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">리포트 URL 추가</p>
            <input
              type="text"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              placeholder="탭 이름 (예: 채권)"
              className="w-full rounded-xl border dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={newTabUrl}
              onChange={(e) => setNewTabUrl(e.target.value)}
              placeholder="리포트 Ajax URL"
              className="w-full rounded-xl border dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100"
            />
            <button
              onClick={handleAddTab}
              disabled={isAddingTab || !newTabName || !newTabUrl}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-50"
            >
              {isAddingTab ? '추가 중...' : '탭 추가하기'}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-2xl h-32 w-full animate-skeleton" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-600">
            <p>리포트 정보가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report, idx) => (
              <div
                key={report.id + idx}
                className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl p-4 shadow-sm animate-fade-in-up"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-primary">{report.institution}</span>
                  <span className="text-xs text-slate-400">{report.date}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3 leading-snug line-clamp-2">
                  {report.title}
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">{report.author}</span>
                  {report.hasFile && (
                    <button
                      onClick={() => handleDownload(report)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary hover:text-white transition-all active:scale-95"
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                      다운로드 {report.fileSize && <span className="text-[10px] opacity-60 ml-0.5">({report.fileSize})</span>}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {hasMore && (
              <div ref={lastElementRef} className="h-20 flex items-center justify-center">
                  {isMoreLoading && (
                      <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav activeTab="report" />

      <TabManagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tabs={tabs}
        onReorder={moveTab}
        onDelete={handleDeleteTab}
        onSave={saveTabOrder}
        title="리포트 탭 관리"
      />
    </div>
  );
}
