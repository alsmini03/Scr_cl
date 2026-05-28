'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, memo, useRef } from 'react';
import { addReportTab, deleteReportTab, updateReportTabOrder, saveReport, getGeminiModels, getGeminiPrompts, getResolvedReportUrlAction, getAdjacentReportIdsAction, toggleLikeAction } from '@/lib/db';
import { cn, getLongPressHandlers } from '@/lib/utils';
import { showToast } from '@/components/Toast';
import TabManagementModal from '@/components/TabManagementModal';
import { useSearchParams, useRouter } from 'next/navigation';
import { marked } from 'marked';
import { useMemo } from 'react';

interface Report {
  id: string;
  index: string;
  date: string;
  title: string;
  author: string;
  institution: string;
  fileId?: string;
  fileNum?: string;
  scrapPath?: string;
  hasFile: boolean;
  fileSize?: string;
}

interface ReportContent {
  id: string;
  content: string;
}

export default function ReportClient({
  session,
  initialTabs,
  initialSavedReports
}: {
  session: any;
  initialTabs: any[];
  initialSavedReports: any[];
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
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [sortType, setSortType] = useState<'date' | 'size-asc' | 'size-desc'>('date');
  const [viewingContent, setViewingContent] = useState<ReportContent | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Search State
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  // Detail View State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedRecommendReport, setSelectedRecommendReport] = useState<Report | null>(null);

  // Navigation states
  const [adjacentIds, setAdjacentIds] = useState<{ prevId?: string; nextId?: string }>({});

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const urlId = searchParams.get('id');
    if (urlId) {
        setSelectedReportId(urlId);
    }

    const savedTab = localStorage.getItem('report_active_tab');
    if (savedTab && tabs.some(t => t.id === savedTab)) {
        setActiveTabId(savedTab);
    } else if (tabs.length > 0) {
        setActiveTabId(tabs[0].id);
    }
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
        localStorage.setItem('report_active_tab', activeTabId);
        fetchReports(true);
    } else if (tabs.length === 0) {
        setIsLoading(false);
    }
  }, [activeTabId]);

  const fetchReports = async (isInitial = false) => {
    if (!activeTabId && tabs.length > 0) return;

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
      const url = activeTab?.url || 'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/PrimeSub04.asp?SubDiv=Sub400';

      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url,
            lstNumO: isInitial ? '0' : lastId,
            actNum: isInitial ? '0' : '2',
            srhDate: '',
            srhWord: ''
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
    if (selectedRecommendReport || selectedReportId || isLoading || isMoreLoading || !hasMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        fetchReports(false);
      }
    });

    if (lastElementRef.current) {
      observer.current.observe(lastElementRef.current);
    }
  }, [reports, isLoading, isMoreLoading, hasMore, selectedRecommendReport, selectedReportId]);

  const fetchContent = async (reportId: string) => {
    if (viewingContent?.id === reportId) {
        return;
    }

    setIsContentLoading(true);
    setIsDetailLoading(true);
    try {
        const [res, adj] = await Promise.all([
            fetch('/api/report/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ num: reportId, code: '01' })
            }),
            getAdjacentReportIdsAction(reportId)
        ]);
        const html = await res.text();
        setViewingContent({ id: reportId, content: html });
        setAdjacentIds(adj);
    } catch (err) {
        console.error(err);
        showToast('내용을 불러오는 중 오류가 발생했습니다.', 'error');
    } finally {
        setIsContentLoading(false);
        setIsDetailLoading(false);
    }
  };

  const handleRecommendClick = (report: Report) => {
      setSelectedRecommendReport(report);
      fetchContent(report.id);
  };

  const handleCopyUrl = (url?: string) => {
      if (!url) return;
      navigator.clipboard.writeText(url).then(() => {
          showToast('URL이 복사되었습니다.');
      }).catch(err => {
          console.error('Copy failed:', err);
          showToast('URL 복사에 실패했습니다.', 'error');
      });
  };

  const handleDownload = async (report: any) => {
    let downloadUrl = '';

    if (report.scrapPath) {
        window.open('https://www.bondweb.co.kr' + report.scrapPath, '_blank');
        return;
    }

    if (report.url) {
        downloadUrl = report.url;
        if (downloadUrl.includes('/api/report/download') && !downloadUrl.includes('&title=')) {
            downloadUrl += `&title=${encodeURIComponent(report.title)}`;
        }
    } else if (report.fileId && report.fileNum) {
        const encodedTitle = encodeURIComponent(report.title);
        downloadUrl = `/api/report/download?number=${report.fileId}&gn=${report.fileNum}&title=${encodedTitle}`;
    }

    if (!downloadUrl) return;

    if (downloadUrl.includes('bondweb.co.kr')) {
        window.open(downloadUrl, '_blank');
        return;
    }

    try {
        const res = await fetch(downloadUrl, { method: 'GET' });
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = report.title.replace(/[\\/:*?"<>|]/g, '_');
        a.download = safeTitle + '.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download error:', error);
        showToast('다운로드 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleToggleLike = async (report: any) => {
    if (!report || isLiking) return;
    setIsLiking(true);
    const newLiked = !report.is_liked;
    try {
      const res = await toggleLikeAction('report', report.id, newLiked);
      if (res.success) {
        // Update local saved reports state if it's a saved report
        if (selectedSavedReport) {
            // Need to update the parent-passed initialSavedReports?
            // Better to have a local state for initialSavedReports if we want it to be reactive.
            // But since it's a Client component, we can use router.refresh() or just local state.
            // For now, I'll update the initialSavedReports if I had them in state.
            // Wait, the component receives initialSavedReports as a prop.
        }
        showToast(newLiked ? '좋아요 항목에 추가되었습니다.' : '좋아요가 취소되었습니다.');
        // Forced reload might be needed if we don't have a local state for saved reports
        router.refresh();
      } else {
        showToast(res.error || '실패했습니다.', 'error');
      }
    } catch (err) {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setIsLiking(false);
    }
  };

  const handleSaveReport = async (report: Report) => {
    if (!session) {
      showToast('로그인이 필요한 서비스입니다.', 'info');
      return;
    }

    setSavingId(report.id);
    try {
      const models = await getGeminiModels();
      const prompts = await getGeminiPrompts();
      const selectedModel = models.find(m => m.report_default)?.name || models[0]?.name || "gemini-1.5-flash";
      const selectedPrompt = prompts.find(p => p.report_default)?.content || prompts[0]?.content;

      let pdfUrl = '';
      if (report.scrapPath) {
          pdfUrl = 'https://www.bondweb.co.kr' + report.scrapPath;
      } else if (report.fileId && report.fileNum) {
          const encodedTitle = encodeURIComponent(report.title);
          pdfUrl = `${window.location.origin}/api/report/download?number=${report.fileId}&gn=${report.fileNum}&title=${encodedTitle}`;
      }

      if (!pdfUrl) throw new Error('PDF URL not found');

      const response = await fetch('/api/report/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: pdfUrl,
          model: selectedModel,
          prompt: selectedPrompt
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '리포트 분석 중 오류가 발생했습니다.');
      }

      const result = await saveReport({
        title: report.title,
        author: report.author,
        institution: report.institution,
        date: report.date,
        url: pdfUrl,
        summary: data.result,
        content: viewingContent?.id === report.id ? viewingContent.content : ''
      });

      if (result.success && result.id) {
        showToast('내 서재에 추가되었습니다.');
      } else {
        showToast(`저장 실패: ${result.error}`, 'error');
      }
    } catch (error: any) {
      console.error(error);
      showToast(`리포트 저장에 실패했습니다: ${error.message}`, 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleAddTab = async () => {
    if (!newTabName || !newTabUrl) return;
    setIsAddingTab(true);
    const res = await addReportTab(newTabName, newTabUrl);
    if (res.success && res.id) {
      setNewTabName('');
      setNewTabUrl('');
      const newTab = { id: res.id, name: newTabName, url: newTabUrl, position: tabs.length };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(res.id);
      setShowTabManager(false);
      showToast('탭이 추가되었습니다.');
    } else {
      showToast(res.error || '탭 추가 실패', 'error');
    }
    setIsAddingTab(false);
  };

  const handleDeleteTab = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('탭을 삭제하시겠습니까?')) return;
    const res = await deleteReportTab(id);
    if (res.success) {
      const remainingTabs = tabs.filter(t => t.id !== id);
      setTabs(remainingTabs);
      if (activeTabId === id) {
          setActiveTabId(remainingTabs.length > 0 ? remainingTabs[0].id : null);
      }
      showToast('탭이 삭제되었습니다.');
    } else {
      showToast(res.error || '삭제 실패', 'error');
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
      showToast(res.error || '저장 실패', 'error');
    }
  };

  const parseSize = (sizeStr?: string) => {
      if (!sizeStr) return 0;
      const num = parseFloat(sizeStr);
      if (sizeStr.includes('MB')) return num * 1024 * 1024;
      if (sizeStr.includes('KB')) return num * 1024;
      return num;
  };

  const sortedReports = useMemo(() => {
      if (sortType === 'date') return reports;

      return [...reports].sort((a, b) => {
          const sizeA = parseSize(a.fileSize);
          const sizeB = parseSize(b.fileSize);
          return sortType === 'size-asc' ? sizeA - sizeB : sizeB - sizeA;
      });
  }, [reports, sortType]);

  const selectedSavedReport = initialSavedReports.find(r => r.id === selectedReportId);
  const isDetailView = !!selectedReportId || !!selectedRecommendReport;

  // If redirected with ID, automatically fetch content
  useEffect(() => {
      if (selectedReportId && !selectedRecommendReport) {
          fetchContent(selectedReportId);
      }
  }, [selectedReportId]);

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 overflow-x-hidden">
      <Header
        title={isDetailView ? "리포트 상세" : "리포트"}
        showBack={isDetailView}
        onBack={() => {
            if (selectedReportId) {
                router.push('/saved?filter=report');
            }
            setSelectedReportId(null);
            setSelectedRecommendReport(null);
        }}
        transparent
        rightAction={
          !isDetailView && (
          <div className="flex items-center gap-1">
                  <button
                    onClick={() => window.location.href = '/settings/gemini'}
                    className="text-primary p-2"
                    title="Gemini 설정"
                  >
                    <span className="material-symbols-outlined text-2xl">settings_suggest</span>
                  </button>
                  <button
                    onClick={() => setShowTabManager(!showTabManager)}
                    className="text-primary p-2"
                  >
                    <span className="material-symbols-outlined text-2xl">{showTabManager ? 'close' : 'add_circle'}</span>
                  </button>
          </div>
          )
        }
      />

      <main className="mt-4 px-4">
        {isDetailLoading ? (
            <SkeletonReportDetail />
        ) : selectedRecommendReport || (selectedReportId && selectedSavedReport) ? (
            /* Detail View (both recommended and saved) */
            <div className="space-y-6 animate-fade-in-up pb-20">
                {/* Navigation Bar */}
                {selectedReportId && (
                <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 rounded-xl p-2 border border-slate-100 dark:border-primary/10 shadow-sm">
                    <button
                        onClick={() => adjacentIds.prevId && setSelectedReportId(adjacentIds.prevId)}
                        disabled={!adjacentIds.prevId}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                        이전
                    </button>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
                    <button
                        onClick={() => adjacentIds.nextId && setSelectedReportId(adjacentIds.nextId)}
                        disabled={!adjacentIds.nextId}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
                    >
                        다음
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={async () => {
                            setIsCopying(true);
                            const current = selectedRecommendReport || selectedSavedReport;
                            const directUrl = await getResolvedReportUrlAction({
                                fileId: current.fileId,
                                fileNum: current.fileNum,
                                url: current.scrapPath ? 'https://www.bondweb.co.kr' + current.scrapPath : current.url
                            });
                            handleCopyUrl(directUrl || '');
                            setIsCopying(false);
                        }}
                        disabled={isCopying}
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[12px] disabled:opacity-50"
                    >
                        {isCopying ? (
                            <div className="size-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg">content_copy</span>
                                URL 복사
                            </>
                        )}
                    </button>
                    {(selectedRecommendReport?.hasFile || selectedSavedReport?.url) && (
                            <button
                            onClick={() => handleDownload(selectedRecommendReport || selectedSavedReport)}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[12px]"
                        >
                            <span className="material-symbols-outlined text-lg">download</span>
                            PDF
                        </button>
                    )}
                    {selectedRecommendReport && (
                        <button
                            onClick={() => handleSaveReport(selectedRecommendReport)}
                            disabled={savingId === selectedRecommendReport.id}
                            className={cn(
                                "flex items-center justify-center gap-1.5 py-2.5 bg-primary text-white rounded-xl font-bold text-[12px] shadow-lg shadow-primary/10 disabled:opacity-50",
                                !selectedRecommendReport.hasFile && "col-span-2"
                            )}
                        >
                            {savingId === selectedRecommendReport.id ? (
                                <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                                    저장
                                </>
                            )}
                        </button>
                    )}
                </div>

                <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                        <span className="text-xs font-bold text-primary">{(selectedRecommendReport || selectedSavedReport).institution}</span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight break-words">
                            {(selectedRecommendReport || selectedSavedReport).title}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {(selectedRecommendReport || selectedSavedReport).author} • {(selectedRecommendReport || selectedSavedReport).date}
                        </p>
                    </div>
                    {selectedSavedReport && (
                        <button
                            onClick={() => handleToggleLike(selectedSavedReport)}
                            disabled={isLiking}
                            className={cn(
                                "flex-shrink-0 p-1.5 transition-all active:scale-125 disabled:opacity-50",
                                selectedSavedReport.is_liked ? "text-red-500" : "text-slate-300 dark:text-slate-700"
                            )}
                        >
                            <span className={cn("material-symbols-outlined text-3xl", selectedSavedReport.is_liked && "fill-1")}>favorite</span>
                        </button>
                    )}
                </div>

                {selectedSavedReport?.summary && (
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-xs font-bold text-primary uppercase mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                            AI 요약 분석
                        </h3>
                        <div
                            className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
                            dangerouslySetInnerHTML={{ __html: marked.parse(selectedSavedReport.summary) }}
                        />
                    </div>
                )}

                {isContentLoading ? (
                    <div className="p-10 flex flex-col items-center justify-center gap-4 text-slate-400">
                        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm">내용을 불러오는 중...</p>
                    </div>
                ) : viewingContent ? (
                    <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 overflow-hidden shadow-sm">
                        <div
                            className="prose prose-sm dark:prose-invert max-w-none break-words p-6"
                            dangerouslySetInnerHTML={{ __html: viewingContent.content }}
                        />
                    </div>
                ) : (
                    <div className="p-10 text-center text-slate-400">내용이 없습니다.</div>
                )}
            </div>
        ) : (
            /* List View */
            <>
            <div className="flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-10">
            <div className="flex flex-col flex-1 gap-3">
            <div className="flex overflow-x-auto no-scrollbar gap-2 py-2 flex-nowrap pt-3 mt-1 pr-16 relative">
                {tabs.map(tab => {
                    const longPressHandlers = getLongPressHandlers(() => handleTabLongPress(tab.id));
                    return (
                        <div
                            key={tab.id}
                            className="relative flex-shrink-0 group transition-all"
                            onContextMenu={(e) => e.preventDefault()}
                            {...longPressHandlers}
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
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm pl-2 py-2">
                    <button
                        onClick={() => {
                            if (sortType === 'date') setSortType('size-desc');
                            else if (sortType === 'size-desc') setSortType('size-asc');
                            else setSortType('date');
                        }}
                        className={cn(
                            "p-2 rounded-full transition-all active:scale-95",
                            sortType === 'date' ? "text-slate-400" : "text-primary bg-primary/10"
                        )}
                        title={sortType === 'date' ? '날짜순' : sortType === 'size-desc' ? '용량 큰순' : '용량 작은순'}
                    >
                        <span className="material-symbols-outlined text-xl">
                            {sortType === 'date' ? 'sort' : sortType === 'size-desc' ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                    </button>
                </div>
            </div>
            </div>
            </div>

            {showTabManager && (
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 space-y-3">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">리포트 URL 추가</p>
                <input
                type="text"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTab()}
                placeholder="탭 이름 (예: 채권)"
                className="w-full rounded-xl border dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100"
                />
                <input
                type="text"
                value={newTabUrl}
                onChange={(e) => setNewTabUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTab()}
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
                <SkeletonReportItem key={i} />
                ))}
            </div>
            ) : reports.length === 0 ? (
            <div className="text-center py-20 text-slate-400 dark:text-slate-600">
                <p>{tabs.length === 0 ? '탭을 추가해 주세요.' : '리포트 정보가 없습니다.'}</p>
            </div>
            ) : (
            <div className="space-y-3">
                {sortedReports.map((report, idx) => (
                <div
                    key={report.id + idx}
                    className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl p-4 shadow-sm animate-fade-in-up hover:border-primary/20 transition-colors"
                >
                    <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[10px] font-bold text-primary uppercase">{report.institution}</span>
                        <span className="text-[10px] text-slate-400">{report.date}</span>
                    </div>

                    <div className="flex justify-between items-start gap-3">
                        <div onClick={() => handleRecommendClick(report)} className="flex-1 cursor-pointer group">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-3 group-hover:text-primary transition-colors">
                                {report.title}
                            </h3>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            {report.hasFile && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDownload(report); }}
                                    className="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg font-bold text-[9px] border border-slate-100 dark:border-primary/5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap min-w-[48px]"
                                >
                                    <span className="material-symbols-outlined text-[14px]">download</span>
                                    {report.fileSize || 'PDF'}
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleSaveReport(report); }}
                                disabled={savingId === report.id}
                                className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-primary text-white rounded-lg font-bold text-[9px] transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50 shadow-sm shadow-primary/10 whitespace-nowrap min-w-[48px]"
                            >
                                {savingId === report.id ? (
                                    <div className="size-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[14px]">save</span>
                                        저장
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div onClick={() => handleRecommendClick(report)} className="cursor-pointer mt-1">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{report.author}</p>
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
            </>
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

export const SkeletonReportDetail = memo(() => (
    <div className="space-y-6 animate-fade-in-up pb-20">
        <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 rounded-xl p-2 border border-slate-100 dark:border-primary/10 shadow-sm">
            <div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton" />
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
            <div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton" />
        </div>

        <div className="grid grid-cols-3 gap-2">
            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-skeleton" />
            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-skeleton" />
            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-skeleton" />
        </div>

        <div className="space-y-2">
            <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton" />
            <div className="h-8 w-3/4 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton" />
            <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton" />
        </div>

        <div className="h-48 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl animate-skeleton" />
        <div className="h-64 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl animate-skeleton" />
    </div>
));

export const SkeletonReportItem = memo(() => (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-1/4" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-1/5" />
        </div>
        <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-3/4" />
        <div className="flex justify-between items-center pt-1">
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-1/6" />
            <div className="flex gap-2">
                <div className="h-7 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-skeleton" />
                <div className="h-7 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-skeleton" />
            </div>
        </div>
    </div>
));
