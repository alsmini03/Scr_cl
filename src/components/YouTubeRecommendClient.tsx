'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, memo } from 'react';
import { saveYoutubeVideo, getGeminiModels, getGeminiPrompts, addYoutubeTab, deleteYoutubeTab, updateYoutubeTabOrder } from '@/lib/db';
import { cn, getLongPressHandlers } from '@/lib/utils';
import { showToast } from '@/components/Toast';
import TabManagementModal from '@/components/TabManagementModal';

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
  initialTabs,
}: {
  session: any;
  initialTabs: any[];
}) {
  const [videos, setVideos] = useState<RecommendedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [cols, setCols] = useState<1 | 2>(1);

  const [tabs, setTabs] = useState<any[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

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
    } else if (tabs.length > 0) {
      setActiveTabId(tabs[0].id);
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

  const fetchVideos = async () => {
    if (!activeTabId) {
      setVideos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let fetchUrl = '/api/youtube/recommend';
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab) {
        fetchUrl += `?url=${encodeURIComponent(activeTab.url)}`;
      } else {
        setVideos([]);
        setIsLoading(false);
        return;
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
    if (activeTabId) {
        fetchVideos();
    }
  }, [activeTabId, tabs]);

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
      const models = await getGeminiModels();
      const prompts = await getGeminiPrompts();
      const selectedModel = models.find(m => m.youtube_default)?.name || models[0]?.name || "gemini-1.5-flash";
      const selectedPrompt = prompts.find(p => p.youtube_default)?.content || prompts[0]?.content;

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

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="유튜브"
        transparent
        rightAction={
          <div className="flex items-center gap-1">
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
          </div>
        }
      />

      <main className="mt-4 px-4">
        {/* Source Tabs */}
        <div className={cn(
          "flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-10"
        )}>
          <div className={cn(
            "flex flex-1 overflow-x-auto no-scrollbar gap-2 py-2 flex-nowrap"
          )}>
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

export const SkeletonVideoItem = memo(({ cols }: { cols: 1 | 2 }) => (
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
      onContextMenu={(e) => e.preventDefault()}
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
