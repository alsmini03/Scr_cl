'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, memo } from 'react';
import { saveYoutubeVideo, deleteYoutubeVideo, batchDeleteYoutubeVideosAction as batchDeleteYoutubeVideos, getGeminiModels, getGeminiPrompts, addYoutubeTab, deleteYoutubeTab, updateYoutubeTabOrder, sendBatchEmailAction } from '@/lib/db';
import { cn, getLongPressHandlers } from '@/lib/utils';
import { showToast } from '@/components/Toast';
import Link from 'next/link';
import TabManagementModal from '@/components/TabManagementModal';
import ViewModeToggle from '@/components/ViewModeToggle';

interface RecommendedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  url: string;
  publishedTime: string;
  viewCount: string;
  duration: string;
}

export default function YouTubeRecommendClient({
  session,
  initialVideos,
  initialTabs,
}: {
  session: any;
  initialVideos: any[];
  initialTabs: any[];
}) {
  const [videos, setVideos] = useState<RecommendedVideo[]>([]);
  const [myVideos, setMyVideos] = useState<any[]>(initialVideos);
  const [isLoading, setIsLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [cols, setCols] = useState<1 | 2>(1);
  const [viewMode, setViewMode] = useState<'my' | 'recommend'>('my');

  const [tabs, setTabs] = useState<any[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Tab Management
  const [showTabManager, setShowTabManager] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const savedTab = localStorage.getItem('youtube_recommend_tab_v2');
    if (savedTab && tabs.some(t => t.id === savedTab)) {
      setActiveTabId(savedTab);
    } else {
      setActiveTabId('all');
    }

    const savedViewMode = localStorage.getItem('youtube_view_mode');
    if (savedViewMode === 'my' || savedViewMode === 'recommend') {
      setViewMode(savedViewMode);
    }

    const savedCols = localStorage.getItem('youtube_recommend_cols');
    if (savedCols === '1' || savedCols === '2') {
      setCols(parseInt(savedCols) as 1 | 2);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('youtube_recommend_cols', cols.toString());
  }, [cols]);

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem('youtube_recommend_tab_v2', activeTabId);
    }
  }, [activeTabId]);

  useEffect(() => {
    localStorage.setItem('youtube_view_mode', viewMode);
  }, [viewMode]);

  const fetchVideos = async () => {
    if (tabs.length === 0 && activeTabId === 'all') {
      setVideos([]);
      return;
    }

    setIsLoading(true);
    try {
      let fetchUrl = '/api/youtube/recommend';
      if (activeTabId === 'all') {
        const allUrls = tabs.map(t => t.url).join(',');
        if (allUrls) {
          fetchUrl += `?url=${encodeURIComponent(allUrls)}`;
        } else {
          setVideos([]);
          setIsLoading(false);
          return;
        }
      } else {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab) {
          fetchUrl += `?url=${encodeURIComponent(activeTab.url)}`;
        }
      }

      const res = await fetch(fetchUrl);
      const data = await res.json();

      setVideos(data.videos || []);
    } catch (err) {
      console.error(err);
      setVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'recommend' && activeTabId) {
        fetchVideos();
    }
  }, [activeTabId, tabs, viewMode]);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
        showToast('URL이 복사되었습니다.');
    }).catch(err => {
      console.error('Copy failed:', err);
      showToast('URL 복사에 실패했습니다.', 'error');
    });
  };

  const handleAddVideo = async (e: React.MouseEvent, video: RecommendedVideo) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      showToast('로그인이 필요한 서비스입니다.', 'info');
      return;
    }

    setAddingId(video.videoId);
    try {
      // 1. Fetch Gemini settings
      const models = await getGeminiModels();
      const prompts = await getGeminiPrompts();
      const selectedModel = models.find(m => m.youtube_default)?.name || models[0]?.name || "gemini-1.5-flash";
      const selectedPrompt = prompts.find(p => p.youtube_default)?.content || prompts[0]?.content;

      // 2. Use existing extract API
      const response = await fetch('/api/youtube/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: video.url,
          model: selectedModel,
          prompt: selectedPrompt
        }),
      });

      if (!response.ok) throw new Error('Failed to extract details');
      const data = await response.json();

      // 3. Save to database
      const result = await saveYoutubeVideo({
        title: data.title || video.title,
        url: video.url,
        thumbnail: data.thumbnail || video.thumbnail,
        duration: data.duration || video.duration,
        published_at: data.publishDate || new Date().toISOString().split('T')[0],
        summary: data.summary || '',
        description: data.description || '',
      });

      if (result.success && result.id) {
        showToast('내 서재에 추가되었습니다.');
        setMyVideos(prev => [{
            id: result.id,
            title: data.title || video.title,
            url: video.url,
            thumbnail: data.thumbnail || video.thumbnail,
            duration: data.duration || video.duration,
            published_at: data.publishDate || new Date().toISOString().split('T')[0],
            added_at: new Date().toISOString()
        }, ...prev]);
      } else {
        showToast(`추가 실패: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('유튜브 영상 추가에 실패했습니다.', 'error');
    } finally {
      setAddingId(null);
    }
  };

  const handleAddTab = async () => {
    if (!newTabName || !newTabUrl) return;
    setIsAddingTab(true);
    const res = await addYoutubeTab(newTabName, newTabUrl);
    if (res.success && res.id) {
      const newTab = { id: res.id, name: newTabName, url: newTabUrl, position: tabs.length };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(res.id);
      setNewTabName('');
      setNewTabUrl('');
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
    const res = await deleteYoutubeTab(id);
    if (res.success) {
      if (activeTabId === id) setActiveTabId('all');
      setTabs(prev => prev.filter(t => t.id !== id));
      showToast('탭이 삭제되었습니다.');
    } else {
      showToast(res.error || '삭제 실패', 'error');
    }
  };

  const handleTabLongPress = (id: string) => {
    setIsModalOpen(true);
  };

  const moveTab = (draggedId: string, hoverId: string) => {
    if (draggedId === hoverId) return;
    const draggedIndex = tabs.findIndex(t => t.id === draggedId);
    const hoverIndex = tabs.findIndex(t => t.id === hoverId);
    const newTabs = [...tabs];
    const [draggedTab] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(hoverIndex, 0, draggedTab);
    setTabs(newTabs);
  };

  const saveTabOrder = async () => {
    const orders = tabs.map((tab, index) => ({ id: tab.id, position: index }));
    const res = await updateYoutubeTabOrder(orders);
    if (!res.success) {
      showToast(res.error || '저장 실패', 'error');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('정말로 삭제하시겠습니까?')) return;
      const res = await deleteYoutubeVideo(id);
      if (res.success) {
          setMyVideos(prev => prev.filter(v => v.id !== id));
          showToast('삭제되었습니다.');
      } else {
          showToast(res.error || '삭제 실패', 'error');
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
    if (!confirm(`선택한 ${selectedIds.length}개의 영상을 삭제하시겠습니까?`)) return;

    setIsLoading(true);
    const res = await batchDeleteYoutubeVideos(selectedIds);
    if (res.success) {
        setIsEditMode(false);
        setMyVideos(prev => prev.filter(v => !selectedIds.includes(v.id)));
        setSelectedIds([]);
        showToast('삭제되었습니다.');
    } else {
        showToast(res.error || '삭제 실패', 'error');
    }
    setIsLoading(false);
  };

  const handleBatchEmail = async () => {
    if (selectedIds.length === 0) return;

    const email = localStorage.getItem('last_blog_email') || 'seokmin.kwon@samsung.com';

    setIsSendingEmail(true);
    try {
      const items = selectedIds.map(id => ({ type: 'youtube' as const, id }));
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

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="유튜브"
        transparent
        rightAction={
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
                    onClick={() => window.location.href = '/add/youtube'}
                    className="text-primary p-2"
                >
                    <span className="material-symbols-outlined text-2xl">add_circle</span>
                </button>
                <button
                  onClick={() => setCols(cols === 1 ? 2 : 1)}
                  className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors flex items-center justify-center"
                >
                  <span className="material-symbols-outlined">
                    {cols === 1 ? 'grid_view' : 'view_stream'}
                  </span>
                </button>
              </>
            )}
          </div>
        }
      >
          <ViewModeToggle
            title="유튜브"
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            myLabel="저장"
            recommendLabel="새글"
          />
      </Header>

      <main className="mt-4 px-4">

        {isEditMode && viewMode === 'my' && (
            <div className="mb-6 flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
                <p className="text-sm font-bold text-red-600 dark:text-red-400 ml-2">
                    {selectedIds.length}개 선택됨
                </p>
                <div className="flex gap-1.5">
                    <button
                        onClick={() => setSelectedIds(selectedIds.length === myVideos.length ? [] : myVideos.map(v => v.id))}
                        className="px-3 py-1.5 text-[10px] leading-tight font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                        {selectedIds.length === myVideos.length ? <>전체<br/>해제</> : <>전체<br/>선택</>}
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

        {viewMode === 'recommend' ? (
        <>
        {/* Source Tabs */}
        <div className={cn(
          "flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-10"
        )}>
          <div className={cn(
            "flex flex-1 overflow-x-auto no-scrollbar gap-2 py-2 flex-nowrap"
          )}>
            <div
                className="relative flex-shrink-0 group transition-all"
                {...getLongPressHandlers(() => handleTabLongPress('all'))}
            >
                <button
                onClick={() => {
                    if (activeTabId === 'all') {
                    fetchVideos();
                    } else {
                    setActiveTabId('all');
                    }
                }}
                className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                    activeTabId === 'all' ? "bg-primary text-white shadow-md" : "bg-slate-200 dark:bg-black/30 text-slate-500 dark:text-slate-400"
                )}
                >
                전체
                </button>
            </div>
            {tabs.map(tab => {
              const longPressHandlers = getLongPressHandlers(() => handleTabLongPress(tab.id));
              return (
              <div
                key={tab.id}
                className={cn(
                  "relative flex-shrink-0 group transition-all"
                )}
                {...longPressHandlers}
              >
                <button
                  onClick={() => {
                    if (activeTabId === tab.id) {
                      fetchVideos();
                    } else {
                      setActiveTabId(tab.id);
                    }
                  }}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                    activeTabId === tab.id ? "bg-primary text-white shadow-md" : "bg-slate-200 dark:bg-black/30 text-slate-500 dark:text-slate-400"
                  )}
                >
                  {tab.name}
                </button>
              </div>
            );})}
          </div>
          <button
            onClick={() => setShowTabManager(!showTabManager)}
            className="flex-shrink-0 size-9 rounded-full bg-slate-200 dark:bg-black/30 text-slate-500 dark:text-slate-400 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-xl">{showTabManager ? 'close' : 'add'}</span>
          </button>
        </div>

        {showTabManager && (
          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 space-y-3">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">탭 추가</p>
            <input
              type="text"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              placeholder="탭 이름 (예: 언더스탠딩)"
              className="w-full rounded-xl border dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={newTabUrl}
              onChange={(e) => setNewTabUrl(e.target.value)}
              placeholder="채널 동영상 URL (예: https://m.youtube.com/@.../videos)"
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
          <div className={cn(
            "grid gap-4",
            cols === 1 ? "grid-cols-1" : "grid-cols-2"
          )}>
            {[...Array(6)].map((_, i) => (
              <SkeletonVideoItem key={i} cols={cols} />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p>추천 영상 정보를 불러올 수 없습니다.</p>
          </div>
        ) : (
          <div className={cn(
            "grid gap-4",
            cols === 1 ? "grid-cols-1" : "grid-cols-2"
          )}>
            {videos.map((video) => (
              <RecommendVideoItem
                key={video.videoId}
                video={video}
                cols={cols}
                isLoggedIn={!!session}
                addingId={addingId}
                onCopyUrl={handleCopyUrl}
                onAdd={handleAddVideo}
              />
            ))}
          </div>
        )}
        </>
        ) : (
            myVideos.length === 0 ? (
                <div className="py-20 text-center text-slate-400">저장된 영상이 없습니다.</div>
            ) : (
                <div className={cn(
                    "grid gap-4 pb-20",
                    cols === 1 ? "grid-cols-1" : "grid-cols-2"
                )}>
                    {myVideos.map((video) => (
                      <MyVideoItem
                        key={video.id}
                        video={video}
                        isEditMode={isEditMode}
                        isSelected={selectedIds.includes(video.id)}
                        onLongPress={handleLongPress}
                        onToggleSelect={toggleSelect}
                      />
                    ))}
                </div>
            )
        )}
      </main>

      <BottomNav activeTab="youtube" />

      <TabManagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tabs={tabs}
        onReorder={moveTab}
        onDelete={handleDeleteTab}
        onSave={saveTabOrder}
        title="유튜브 탭 관리"
      />
    </div>
  );
}

const SkeletonVideoItem = memo(({ cols }: { cols: 1 | 2 }) => (
  <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl shadow-sm p-3">
    <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl mb-3 animate-skeleton" />
    <div className="space-y-2">
      <div className={cn(
        "bg-slate-100 dark:bg-slate-800 rounded animate-skeleton",
        cols === 1 ? "h-5 w-3/4" : "h-4 w-5/6"
      )} />
      <div className={cn(
        "bg-slate-100 dark:bg-slate-800 rounded animate-skeleton",
        cols === 1 ? "h-3 w-1/4" : "h-2 w-1/3"
      )} />
    </div>
  </div>
));

const RecommendVideoItem = memo(({ video, cols, isLoggedIn, addingId, onCopyUrl, onAdd }: any) => {
  const longPressHandlers = getLongPressHandlers(() => onCopyUrl(video.url));

  return (
    <div
      className="group relative bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl shadow-sm hover:border-primary/20 transition-colors animate-fade-in-up"
      {...longPressHandlers}
    >
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex flex-col rounded-2xl",
          cols === 1 ? "p-3" : "p-2"
        )}
      >
        <div className="relative w-full aspect-video bg-slate-100 rounded-xl overflow-hidden mb-3">
          <div
            className="w-full h-full bg-center bg-no-repeat bg-cover"
            style={{ backgroundImage: `url("${video.thumbnail}")` }}
          />
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 text-white text-[9px] font-bold rounded">
            {video.duration}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2 mb-1">
            <p className={cn(
              "font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug",
              cols === 1 ? "text-base" : "text-[13px]"
            )}>{video.title}</p>

            {isLoggedIn && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(e, video); }}
                disabled={addingId === video.videoId}
                className={cn(
                  "flex-shrink-0 bg-primary/10 text-primary rounded-lg flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-90 disabled:opacity-50",
                  cols === 1 ? "size-9" : "size-7"
                )}
                title="내 서재에 추가"
              >
                {addingId === video.videoId ? (
                  <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className={cn("material-symbols-outlined", cols === 1 ? "text-lg" : "text-base")}>library_add</span>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="truncate">{video.viewCount}</span>
            <span>•</span>
            <span className="truncate">{video.publishedTime}</span>
          </div>
        </div>
      </a>
    </div>
  );
});

const MyVideoItem = memo(({ video, isEditMode, isSelected, onLongPress, onToggleSelect }: any) => {
  const longPressHandlers = getLongPressHandlers(() => onLongPress(video.id), 500);

  return (
    <div className="relative animate-fade-in-up">
        <Link
            href={isEditMode ? '#' : `/youtube/${video.id}`}
            onClick={(e) => isEditMode && onToggleSelect(video.id, e)}
            {...longPressHandlers}
            className={cn(
                "flex flex-col bg-white dark:bg-slate-900/50 rounded-2xl border overflow-hidden shadow-sm active:scale-[0.98] transition-all relative group",
                isEditMode && isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-100 dark:border-primary/10"
            )}
        >
            <div className="aspect-video relative w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {video.duration}
                </div>
                {isEditMode && (
                    <div className="absolute top-2 right-2">
                        <div className={cn(
                            "size-6 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected ? "bg-primary border-primary" : "border-white/50 bg-black/20"
                        )}>
                            {isSelected && <span className="material-symbols-outlined text-white text-sm font-bold">check</span>}
                        </div>
                    </div>
                )}
            </div>
            <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight mb-1 text-sm">{video.title}</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{video.published_at}</p>
                </div>
            </div>
        </Link>
    </div>
  );
});
