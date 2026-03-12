'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState } from 'react';
import { saveYoutubeVideo, getGeminiModels, getGeminiPrompts, getYoutubeTabs, addYoutubeTab, deleteYoutubeTab, updateYoutubeTabOrder } from '@/lib/db';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

interface RecommendedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  url: string;
  publishedTime: string;
  viewCount: string;
  duration: string;
}

export default function YouTubeRecommendPage() {
  const { data: session } = useSession();
  const [videos, setVideos] = useState<RecommendedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [cols, setCols] = useState<1 | 2>(1);
  const [tabs, setTabs] = useState<any[]>([]);
  const [activeTabId, setActiveTabId] = useState('all');

  // Tab Management
  const [showTabManager, setShowTabManager] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    const savedTab = localStorage.getItem('youtube_recommend_tab_v2');
    if (savedTab) {
      setActiveTabId(savedTab);
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
    localStorage.setItem('youtube_recommend_tab_v2', activeTabId);
  }, [activeTabId]);

  const loadTabs = async () => {
    const dbTabs = await getYoutubeTabs();
    setTabs(dbTabs);
  };

  useEffect(() => {
    loadTabs();
  }, []);

  useEffect(() => {
    async function fetchVideos() {
      if (tabs.length === 0 && activeTabId === 'all') {
        setVideos([]);
        setIsLoading(false);
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
    }

    // Only fetch if tabs are loaded or if activeTab is 'all'
    if (activeTabId === 'all' || tabs.length > 0) {
      fetchVideos();
    }
  }, [activeTabId, tabs]);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      alert('URL이 클립보드에 복사되었습니다.');
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  };

  const handleAddVideo = async (e: React.MouseEvent, video: RecommendedVideo) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }

    setAddingId(video.videoId);
    try {
      // 1. Fetch Gemini settings (same as manual add)
      const models = await getGeminiModels();
      const prompts = await getGeminiPrompts();
      const selectedModel = models.find(m => m.is_default)?.name || models[0]?.name || "gemini-1.5-flash";
      const selectedPrompt = prompts.find(p => p.is_default)?.content || prompts[0]?.content;

      // 2. Use existing extract API to get summary and detailed metadata
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

      if (result.success) {
        alert('유튜브 영상이 내 서재에 추가되었습니다.');
      } else {
        alert(`추가 실패: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('유튜브 영상 추가에 실패했습니다.');
    } finally {
      setAddingId(null);
    }
  };

  const handleAddTab = async () => {
    if (!newTabName || !newTabUrl) return;
    setIsAddingTab(true);
    const res = await addYoutubeTab(newTabName, newTabUrl);
    if (res.success) {
      setNewTabName('');
      setNewTabUrl('');
      await loadTabs();
    } else {
      alert(res.error);
    }
    setIsAddingTab(false);
  };

  const handleDeleteTab = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('탭을 삭제하시겠습니까?')) return;
    const res = await deleteYoutubeTab(id);
    if (res.success) {
      if (activeTabId === id) setActiveTabId('all');
      await loadTabs();
    }
  };

  const handleTabLongPress = (id: string) => {
    if (id === 'all') return;
    setIsReordering(true);
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
    if (res.success) {
      setIsReordering(false);
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="유튜브 추천"
        transparent
        rightAction={
          <div className="flex items-center gap-1">
            {isReordering ? (
              <button
                onClick={saveTabOrder}
                className="text-primary font-bold px-3 py-1 bg-primary/10 rounded-lg"
              >
                순서 저장
              </button>
            ) : (
              <>
                <button
                   onClick={() => window.location.href = '/add/youtube'}
                   className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors flex items-center justify-center"
                >
                   <span className="material-symbols-outlined">settings</span>
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
      />

      <main className="mt-4 px-4">
        {/* Source Tabs */}
        <div className="flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-10">
          <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 py-2">
            {!isReordering && (
              <button
                onClick={() => setActiveTabId('all')}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                  activeTabId === 'all' ? "bg-primary text-white shadow-md" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                )}
              >
                전체
              </button>
            )}
            {tabs.map(tab => {
              let timer: any;
              const handleTouchStart = () => {
                timer = setTimeout(() => handleTabLongPress(tab.id), 600);
              };
              const handleTouchEnd = () => {
                clearTimeout(timer);
              };

              return (
              <div
                key={tab.id}
                className={cn(
                  "relative flex-shrink-0 group transition-all",
                  isReordering && draggedId === tab.id ? "opacity-50 scale-95" : "opacity-100"
                )}
                draggable={isReordering}
                onDragStart={() => setDraggedId(tab.id)}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedId) moveTab(draggedId, tab.id);
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
              >
                <button
                  onClick={() => !isReordering && setActiveTabId(tab.id)}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all pr-8",
                    activeTabId === tab.id && !isReordering ? "bg-primary text-white shadow-md" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                    isReordering && "cursor-move"
                  )}
                >
                  {isReordering && <span className="material-symbols-outlined text-[14px] mr-1 align-middle">drag_indicator</span>}
                  {tab.name}
                </button>
                {!isReordering && (
                  <button
                    onClick={(e) => handleDeleteTab(tab.id, e)}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors",
                      activeTabId === tab.id ? "text-white/70" : "text-slate-400"
                    )}
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
              </div>
            );})}
          </div>
          {!isReordering && (
            <button
              onClick={() => setShowTabManager(!showTabManager)}
              className="flex-shrink-0 size-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-xl">{showTabManager ? 'close' : 'add'}</span>
            </button>
          )}
          {isReordering && (
            <button
              onClick={() => setIsReordering(false)}
              className="flex-shrink-0 size-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          )}
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
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-slate-500 font-medium">추천 영상을 읽어오는 중...</p>
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
            {videos.map((video) => {
              let timer: any;
              const startPress = () => {
                timer = setTimeout(() => handleCopyUrl(video.url), 600);
              };
              const endPress = () => {
                clearTimeout(timer);
              };

              return (
              <div
                key={video.videoId}
                className="group relative bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl shadow-sm hover:border-primary/20 transition-colors"
                onTouchStart={startPress}
                onTouchEnd={endPress}
                onMouseDown={startPress}
                onMouseUp={endPress}
                onMouseLeave={endPress}
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

                      {session && (
                        <button
                          onClick={(e) => handleAddVideo(e, video)}
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
            );})}
          </div>
        )}
      </main>

      <BottomNav activeTab="youtube" />
    </div>
  );
}
