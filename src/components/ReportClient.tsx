'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, memo, useRef } from 'react';
import { addReportTab, deleteReportTab, updateReportTabOrder, saveReport, getGeminiModels, getGeminiPrompts, deleteReport, updateReport, sendBatchEmailAction, getResolvedReportUrlAction } from '@/lib/db';
import { cn, getLongPressHandlers } from '@/lib/utils';
import { showToast } from '@/components/Toast';
import TabManagementModal from '@/components/TabManagementModal';
import ViewModeToggle from '@/components/ViewModeToggle';
import { marked } from 'marked';
import he from 'he';

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

interface SavedReport {
    id: string;
    title: string;
    author?: string;
    institution?: string;
    date?: string;
    url?: string;
    summary?: string;
    content?: string;
    added_at: string;
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
  const [savedReports, setSavedReports] = useState<SavedReport[]>(initialSavedReports);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [tabs, setTabs] = useState<any[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showTabManager, setShowTabManager] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [lastId, setLastId] = useState('0');
  const [hasMore, setHasMore] = useState(true);
  const [viewingContent, setViewingContent] = useState<ReportContent | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'my' | 'recommend'>('recommend');

  // Search State
  const [searchWord, setSearchWord] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  // Detail View State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedRecommendReport, setSelectedRecommendReport] = useState<Report | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editSummary, setEditSummary] = useState('');

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedViewMode = localStorage.getItem('report_view_mode');
    if (savedViewMode === 'my' || savedViewMode === 'recommend') {
        setViewMode(savedViewMode);
    }

    const savedTab = localStorage.getItem('report_active_tab');
    if (savedTab && tabs.some(t => t.id === savedTab)) {
        setActiveTabId(savedTab);
    } else if (tabs.length > 0) {
        setActiveTabId(tabs[0].id);
    }
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem('report_view_mode', viewMode);
    // Reset selection when changing tabs
    setSelectedReportId(null);
    setSelectedRecommendReport(null);
    setIsEditing(false);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'recommend' && activeTabId) {
        localStorage.setItem('report_active_tab', activeTabId);
        fetchReports(true);
    } else if (viewMode === 'recommend' && tabs.length === 0) {
        setIsLoading(false);
    }
  }, [activeTabId, viewMode]);

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
            srhWord: searchWord
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
    if (viewMode !== 'recommend' || selectedRecommendReport || isLoading || isMoreLoading || !hasMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        fetchReports(false);
      }
    });

    if (lastElementRef.current) {
      observer.current.observe(lastElementRef.current);
    }
  }, [reports, isLoading, isMoreLoading, hasMore, viewMode, selectedRecommendReport]);

  const fetchContent = async (report: Report) => {
    if (viewingContent?.id === report.id) {
        return;
    }

    setIsContentLoading(true);
    try {
        const res = await fetch('/api/report/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ num: report.id, code: '01' })
        });
        const html = await res.text();
        setViewingContent({ id: report.id, content: html });
    } catch (err) {
        console.error(err);
        showToast('내용을 불러오는 중 오류가 발생했습니다.', 'error');
    } finally {
        setIsContentLoading(false);
    }
  };

  const handleRecommendClick = (report: Report) => {
      setSelectedRecommendReport(report);
      fetchContent(report);
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

  const handleDownload = async (report: Report | SavedReport) => {
    let downloadUrl = '';

    if ('scrapPath' in report && report.scrapPath) {
        window.open('https://www.bondweb.co.kr' + report.scrapPath, '_blank');
        return;
    }

    if ('url' in report && report.url) {
        downloadUrl = report.url;
        if (downloadUrl.includes('/api/report/download') && !downloadUrl.includes('&title=')) {
            downloadUrl += `&title=${encodeURIComponent(report.title)}`;
        }
    } else if ('fileId' in report && report.fileId && 'fileNum' in report && report.fileNum) {
        const encodedTitle = encodeURIComponent(report.title);
        downloadUrl = `/api/report/download?number=${report.fileId}&gn=${report.fileNum}&title=${encodedTitle}`;
    }

    if (!downloadUrl) return;

    // For external bondweb links, just open in new tab
    if (downloadUrl.includes('bondweb.co.kr')) {
        window.open(downloadUrl, '_blank');
        return;
    }

    try {
        const res = await fetch(downloadUrl, {
            method: 'GET'
        });

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

      if (!response.ok) throw new Error('Failed to extract details');
      const data = await response.json();

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
        setSavedReports(prev => [{
            id: result.id!,
            title: report.title,
            author: report.author,
            institution: report.institution,
            date: report.date,
            url: pdfUrl,
            summary: data.result,
            content: viewingContent?.id === report.id ? viewingContent.content : '',
            added_at: new Date().toISOString()
        }, ...prev]);
        // Stay in recommendation list after save
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

  const handleDeleteSaved = async (id: string, e?: React.MouseEvent) => {
      if (e) {
          e.preventDefault();
          e.stopPropagation();
      }
      if (!confirm('정말로 삭제하시겠습니까?')) return;
      const res = await deleteReport(id);
      if (res.success) {
          setSavedReports(prev => prev.filter(r => r.id !== id));
          if (selectedReportId === id) {
              setSelectedReportId(null);
              setIsEditing(false);
          }
      }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleLongPress = (id: string) => {
    setIsEditMode(true);
    setSelectedIds([id]);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`선택한 ${selectedIds.length}개의 리포트를 삭제하시겠습니까?`)) return;

    setIsLoading(true);
    try {
        for (const id of selectedIds) {
            await deleteReport(id);
        }
        setSavedReports(prev => prev.filter(r => !selectedIds.includes(r.id)));
        setIsEditMode(false);
        setSelectedIds([]);
    } catch (err) {
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleBatchEmail = async () => {
    if (selectedIds.length === 0) return;

    const lastEmail = localStorage.getItem('last_blog_email') || 'seokmin.kwon@samsung.com';
    const email = window.prompt('보내실 이메일 주소를 입력해 주세요:', lastEmail);

    if (!email) return;
    localStorage.setItem('last_blog_email', email);

    setIsSendingEmail(true);
    try {
      const items = selectedIds.map(id => ({ type: 'report' as const, id }));
      const res = await sendBatchEmailAction(items, email);
      if (res.success) {
        showToast('메일이 발송되었습니다.');
        setIsEditMode(false);
        setSelectedIds([]);
      } else {
        showToast(res.error || '발송 실패', 'error');
      }
    } catch (err: any) {
      showToast(`발송 실패: ${err.message}`, 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleStartEdit = (report: SavedReport) => {
      setEditTitle(report.title);
      setEditAuthor(report.author || '');
      setEditInstitution(report.institution || '');
      setEditSummary(he.decode(report.summary || ''));
      setIsEditing(true);
  };

  const handleUpdateReport = async () => {
    if (!selectedReportId || !selectedReport) return;

    setIsLoading(true);
    try {
        const res = await updateReport(selectedReportId, {
            title: editTitle,
            author: editAuthor,
            institution: editInstitution,
            summary: editSummary,
            date: selectedReport.date,
            content: selectedReport.content
        });

        if (res.success) {
            setSavedReports(prev => prev.map(r =>
                r.id === selectedReportId
                ? { ...r, title: editTitle, author: editAuthor, institution: editInstitution, summary: editSummary }
                : r
            ));
            setIsEditing(false);
            showToast('수정되었습니다.');
        } else {
            showToast(res.error || '수정 실패', 'error');
        }
    } catch (err) {
        console.error(err);
    } finally {
        setIsLoading(false);
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

  const selectedReport = savedReports.find(r => r.id === selectedReportId);
  const isDetailView = !!selectedReportId || !!selectedRecommendReport;

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title={isDetailView ? "리포트 상세" : "리포트"}
        showBack={isDetailView}
        onBack={() => {
            if (isEditing) {
                setIsEditing(false);
            } else {
                setSelectedReportId(null);
                setSelectedRecommendReport(null);
            }
        }}
        transparent
        rightAction={
          !isDetailView && (
          <div className="flex items-center gap-1">
              {isEditMode ? (
                  <button
                    onClick={() => { setIsEditMode(false); setSelectedIds([]); }}
                    className="text-slate-500 font-bold px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg mr-2"
                  >
                    취소
                  </button>
              ) : (
                  <>
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
                  </>
              )}
          </div>
          )
        }
      >
          {!isDetailView && (
          <ViewModeToggle
            title="리포트"
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            myLabel="저장"
            recommendLabel="새글"
          />
          )}
      </Header>

      <main className="mt-4 px-4">
        {viewMode === 'recommend' ? (
        <>
        {selectedRecommendReport ? (
            /* Recommend Detail View */
            <div className="space-y-6 animate-fade-in-up pb-20">
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={async () => {
                            setIsCopying(true);
                            const directUrl = await getResolvedReportUrlAction({
                                fileId: selectedRecommendReport.fileId,
                                fileNum: selectedRecommendReport.fileNum,
                                url: selectedRecommendReport.scrapPath ? 'https://www.bondweb.co.kr' + selectedRecommendReport.scrapPath : undefined
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
                    {selectedRecommendReport.hasFile && (
                            <button
                            onClick={() => handleDownload(selectedRecommendReport)}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[12px]"
                        >
                            <span className="material-symbols-outlined text-lg">download</span>
                            PDF
                        </button>
                    )}
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
                </div>

                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-primary">{selectedRecommendReport.institution}</span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {selectedRecommendReport.title}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {selectedRecommendReport.author} • {selectedRecommendReport.date}
                        </p>
                    </div>
                </div>

                {isContentLoading ? (
                    <div className="p-10 flex flex-col items-center justify-center gap-4 text-slate-400">
                        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm">내용을 불러오는 중...</p>
                    </div>
                ) : viewingContent?.id === selectedRecommendReport.id ? (
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
            /* Recommend List View */
            <>
            <div className="flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-10">
            <div className="flex flex-col flex-1 gap-3">
            {/* Search Bar */}
            <div className="flex flex-col gap-2 p-1">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={searchWord}
                            onChange={(e) => setSearchWord(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchReports(true)}
                            placeholder="검색어 입력..."
                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs p-3 pl-9 outline-none text-slate-700 dark:text-slate-200"
                        />
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    </div>
                    <button
                        onClick={() => fetchReports(true)}
                        className="bg-primary text-white font-bold px-5 rounded-xl text-xs shadow-md active:scale-95 transition-all"
                    >
                        검색
                    </button>
                </div>
            </div>

            <div className="flex overflow-x-auto no-scrollbar gap-2 py-2 flex-nowrap border-t border-slate-100 dark:border-primary/5 pt-3 mt-1">
                {tabs.map(tab => {
                    const longPressHandlers = getLongPressHandlers(() => handleTabLongPress(tab.id));
                    return (
                        <div
                            key={tab.id}
                            className="relative flex-shrink-0 group transition-all"
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
                <p>{tabs.length === 0 ? '탭을 추가해 주세요.' : '리포트 정보가 없습니다.'}</p>
            </div>
            ) : (
            <div className="space-y-3">
                {reports.map((report, idx) => (
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
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
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
        </>
        ) : selectedReportId && selectedReport ? (
            /* Saved View Mode - Detail View */
            <div className="space-y-6 animate-fade-in-up pb-20">
                {isEditing ? (
                    /* Edit Mode */
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">제목</label>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-primary"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">작성자</label>
                                <input
                                    type="text"
                                    value={editAuthor}
                                    onChange={(e) => setEditAuthor(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-primary"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">기관</label>
                                <input
                                    type="text"
                                    value={editInstitution}
                                    onChange={(e) => setEditInstitution(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-primary"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">AI 요약 분석 (Markdown)</label>
                            <textarea
                                value={editSummary}
                                onChange={(e) => setEditSummary(e.target.value)}
                                className="w-full h-80 rounded-xl border border-slate-200 dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-primary resize-none"
                            />
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold text-sm"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleUpdateReport}
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20"
                            >
                                저장하기
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Read Mode */
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={async () => {
                                    setIsCopying(true);
                                    const directUrl = await getResolvedReportUrlAction({
                                        url: selectedReport.url
                                    });
                                    handleCopyUrl(directUrl || '');
                                    setIsCopying(false);
                                }}
                                disabled={isCopying}
                                className="flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm disabled:opacity-50"
                            >
                                {isCopying ? (
                                    <div className="size-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-xl">content_copy</span>
                                        URL 복사
                                    </>
                                )}
                            </button>
                            {selectedReport.url && (
                                <button
                                    onClick={() => handleDownload(selectedReport)}
                                    className="flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm"
                                >
                                    <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                                    PDF 보기
                                </button>
                            )}
                        </div>

                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-primary">{selectedReport.institution}</span>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                    {selectedReport.title}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {selectedReport.author} • {selectedReport.date}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleStartEdit(selectedReport)}
                                    className="text-slate-400 hover:text-primary p-2 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
                                >
                                    <span className="material-symbols-outlined text-xl">edit</span>
                                </button>
                                <button
                                    onClick={() => handleDeleteSaved(selectedReport.id)}
                                    className="text-slate-400 hover:text-red-500 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
                                >
                                    <span className="material-symbols-outlined text-xl">delete</span>
                                </button>
                            </div>
                        </div>

                        {selectedReport.summary && (
                            <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl p-5 shadow-sm">
                                <h3 className="text-xs font-bold text-primary uppercase mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                    AI 요약 분석
                                </h3>
                                <div
                                    className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(selectedReport.summary) }}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        ) : (
            /* Saved View Mode - List View */
            <>
            {isEditMode && (
                <div className="mb-6 flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400 ml-2">
                        {selectedIds.length}개 선택됨
                    </p>
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => setSelectedIds(selectedIds.length === savedReports.length ? [] : savedReports.map(r => r.id))}
                            className="px-3 py-1.5 text-[10px] leading-tight font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                            {selectedIds.length === savedReports.length ? <>전체<br/>해제</> : <>전체<br/>선택</>}
                        </button>
                        <button
                            onClick={handleBatchEmail}
                            disabled={selectedIds.length === 0 || isSendingEmail}
                            className="px-3 py-1.5 text-[10px] leading-tight font-bold bg-primary text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[56px]"
                        >
                            {isSendingEmail ? (
                                <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>메일<br/>발송</>
                            )}
                        </button>
                        <button
                            onClick={handleBatchDelete}
                            disabled={selectedIds.length === 0 || isSendingEmail}
                            className="px-3 py-1.5 text-[10px] leading-tight font-bold bg-red-500 text-white rounded-lg shadow-sm disabled:opacity-50"
                        >
                            삭제
                        </button>
                    </div>
                </div>
            )}
            <div className="space-y-3 pb-20">
                {savedReports.length === 0 ? (
                    <div className="py-20 text-center text-slate-400">저장된 리포트가 없습니다.</div>
                ) : (
                    savedReports.map(report => {
                        const isSelected = selectedIds.includes(report.id);
                        const longPressHandlers = getLongPressHandlers(() => handleLongPress(report.id), 500);
                        return (
                            <div
                                key={report.id}
                                onClick={() => isEditMode ? toggleSelect(report.id) : setSelectedReportId(report.id)}
                                {...longPressHandlers}
                                className={cn(
                                    "bg-white dark:bg-slate-900/50 border rounded-2xl p-4 shadow-sm animate-fade-in-up cursor-pointer transition-all relative group",
                                    isEditMode && isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-100 dark:border-primary/10 hover:border-primary/20"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-primary">{report.institution}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400">{report.date}</span>
                                        {isEditMode && (
                                            <div className={cn(
                                                "size-5 rounded-full border flex items-center justify-center transition-all",
                                                isSelected ? "bg-primary border-primary" : "border-slate-300 dark:border-slate-700"
                                            )}>
                                                {isSelected && <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 line-clamp-1">{report.title}</h3>
                                <div className="flex justify-between items-center">
                                    <div className="text-[12px] text-slate-500 dark:text-slate-400">{report.author}</div>
                                    {!isEditMode && <span className="material-symbols-outlined text-slate-300 text-sm font-bold">arrow_forward_ios</span>}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
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
