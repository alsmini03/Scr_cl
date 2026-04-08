'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, memo, useRef } from 'react';
import { addReportTab, deleteReportTab, updateReportTabOrder, saveReport, getGeminiModels, getGeminiPrompts, deleteReport, updateReport } from '@/lib/db';
import { cn, getLongPressHandlers } from '@/lib/utils';
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
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [lastId, setLastId] = useState('0');
  const [hasMore, setHasMore] = useState(true);
  const [viewingContent, setViewingContent] = useState<ReportContent | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'my' | 'recommend'>('recommend');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Detail View State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
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
    if (viewMode === 'recommend') {
        setSelectedReportId(null);
        setIsEditing(false);
    }
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
    if (viewMode !== 'recommend' || isLoading || isMoreLoading || !hasMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        fetchReports(false);
      }
    });

    if (lastElementRef.current) {
      observer.current.observe(lastElementRef.current);
    }
  }, [reports, isLoading, isMoreLoading, hasMore, viewMode]);

  const fetchContent = async (report: Report) => {
    if (viewingContent?.id === report.id) {
        setViewingContent(null);
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
        alert('내용을 불러오는 중 오류가 발생했습니다.');
    } finally {
        setIsContentLoading(false);
    }
  };

  const handleDownload = async (report: Report) => {
    if (report.scrapPath) {
        window.open('https://www.bondweb.co.kr' + report.scrapPath, '_blank');
        return;
    }

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
        const safeTitle = report.title.replace(/[\\/:*?"<>|]/g, '_');
        a.download = safeTitle + '.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download error:', error);
        alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleSaveReport = async (report: Report) => {
    if (!session) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }

    setSavingId(report.id);
    try {
      const models = await getGeminiModels();
      const prompts = await getGeminiPrompts();
      const selectedModel = models.find(m => m.is_default)?.name || models[0]?.name || "gemini-1.5-flash";
      const selectedPrompt = prompts.find(p => p.is_default)?.content || prompts[0]?.content;

      let pdfUrl = '';
      if (report.scrapPath) {
          pdfUrl = 'https://www.bondweb.co.kr' + report.scrapPath;
      } else if (report.fileId && report.fileNum) {
          pdfUrl = `${window.location.origin}/api/report/download?number=${report.fileId}&gn=${report.fileNum}`;
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
        alert('리포트가 저장되었습니다.');
        setSavedReports(prev => [{
            id: result.id!,
            title: report.title,
            author: report.author,
            institution: report.institution,
            date: report.date,
            url: pdfUrl,
            summary: data.result,
            added_at: new Date().toISOString()
        }, ...prev]);
      } else {
        alert(`저장 실패: ${result.error}`);
      }
    } catch (error: any) {
      console.error(error);
      alert(`리포트 저장에 실패했습니다: ${error.message}`);
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
        } else {
            alert(res.error);
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
      const newTabs = [...tabs, { id: res.id, name: newTabName, url: newTabUrl }];
      setTabs(newTabs);
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
      const remainingTabs = tabs.filter(t => t.id !== id);
      setTabs(remainingTabs);
      if (activeTabId === id) {
          setActiveTabId(remainingTabs.length > 0 ? remainingTabs[0].id : null);
      }
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

  const selectedReport = savedReports.find(r => r.id === selectedReportId);

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title={selectedReportId ? "리포트 상세" : "리포트"}
        showBack={!!selectedReportId}
        onBack={() => {
            if (isEditing) {
                setIsEditing(false);
            } else {
                setSelectedReportId(null);
            }
        }}
        transparent
        rightAction={
          !selectedReportId && (
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
      >
          {!selectedReportId && (
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
        {/* Recommend View (Existing Logic) */}
        <div className="flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-10">
          <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 py-2 flex-nowrap">
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
                className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl p-4 shadow-sm animate-fade-in-up"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-primary">{report.institution}</span>
                  <div className="flex items-center gap-3">
                      {report.hasFile && (
                          <button
                            onClick={() => handleSaveReport(report)}
                            disabled={savingId === report.id}
                            className="text-primary hover:bg-primary/10 p-1 rounded-full transition-colors disabled:opacity-50"
                            title="AI 분석 및 저장"
                          >
                            {savingId === report.id ? (
                                <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined text-xl">bookmark_add</span>
                            )}
                          </button>
                      )}
                      <span className="text-xs text-slate-400">{report.date}</span>
                  </div>
                </div>
                <h3
                  onClick={() => fetchContent(report)}
                  className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3 leading-snug line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                >
                  {report.title}
                </h3>

                {viewingContent?.id === report.id && (
                    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden">
                        <div
                            className="prose prose-sm dark:prose-invert max-w-none break-words bg-white p-4"
                            dangerouslySetInnerHTML={{ __html: viewingContent.content }}
                        />
                    </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">{report.author}</span>
                  {report.hasFile && (
                    <button
                      onClick={() => handleDownload(report)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary hover:text-white transition-all active:scale-95"
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                      {report.fileSize || '다운로드'}
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

                        {selectedReport.url && (
                             <a
                                href={selectedReport.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-primary/5 hover:bg-primary/5 transition-colors group"
                             >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">picture_as_pdf</span>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">원본 PDF 보기</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-400 text-sm">open_in_new</span>
                             </a>
                        )}
                    </>
                )}
            </div>
        ) : (
            /* Saved View Mode - List View */
            <div className="space-y-3 pb-20">
                {savedReports.length === 0 ? (
                    <div className="py-20 text-center text-slate-400">저장된 리포트가 없습니다.</div>
                ) : (
                    savedReports.map(report => (
                        <div
                            key={report.id}
                            onClick={() => setSelectedReportId(report.id)}
                            className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl p-4 shadow-sm animate-fade-in-up cursor-pointer hover:border-primary/20 transition-colors"
                        >
                             <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-primary">{report.institution}</span>
                                <span className="text-xs text-slate-400">{report.date}</span>
                            </div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 line-clamp-1">{report.title}</h3>
                            <div className="flex justify-between items-center">
                                <div className="text-[12px] text-slate-500 dark:text-slate-400">{report.author}</div>
                                <span className="material-symbols-outlined text-slate-300 text-sm font-bold">arrow_forward_ios</span>
                            </div>
                        </div>
                    ))
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
