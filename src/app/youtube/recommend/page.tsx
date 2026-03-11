'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState } from 'react';
import { saveYoutubeVideo, getGeminiModels, getGeminiPrompts } from '@/lib/db';
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
  const [allData, setAllData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [cols, setCols] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState<'all' | 'under' | 'sampro' | 'eo'>('all');

  useEffect(() => {
    const savedTab = localStorage.getItem('youtube_recommend_tab');
    if (savedTab && (savedTab === 'all' || savedTab === 'under' || savedTab === 'sampro' || savedTab === 'eo')) {
      setActiveTab(savedTab as any);
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
    localStorage.setItem('youtube_recommend_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    async function fetchRecommended() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/youtube/recommend');
        const data = await res.json();
        setAllData(data);
        if (data && data.all) {
          setVideos(data.all);
        } else {
          setVideos([]);
        }
      } catch (err) {
        console.error(err);
        setVideos([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRecommended();
  }, []);

  useEffect(() => {
    if (!allData) return;
    if (activeTab === 'all') setVideos(allData.all || []);
    else if (activeTab === 'under') setVideos(allData.under || []);
    else if (activeTab === 'sampro') setVideos(allData.sampro || []);
    else if (activeTab === 'eo') setVideos(allData.eo || []);
  }, [activeTab, allData]);

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

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header
        title="유튜브 추천"
        transparent
        rightAction={
          <button
            onClick={() => setCols(cols === 1 ? 2 : 1)}
            className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined">
              {cols === 1 ? 'grid_view' : 'view_stream'}
            </span>
          </button>
        }
      />

      <main className="mt-4 px-4">
        {/* Source Tabs */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 mb-6 pb-2 -mx-4 px-4 sticky top-[64px] bg-white z-10">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
              activeTab === 'all' ? "bg-primary text-white shadow-md" : "bg-slate-100 text-slate-500"
            )}
          >
            전체
          </button>
          <button
            onClick={() => setActiveTab('under')}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
              activeTab === 'under' ? "bg-primary text-white shadow-md" : "bg-slate-100 text-slate-500"
            )}
          >
            언더스탠딩
          </button>
          <button
            onClick={() => setActiveTab('sampro')}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
              activeTab === 'sampro' ? "bg-primary text-white shadow-md" : "bg-slate-100 text-slate-500"
            )}
          >
            삼프로TV
          </button>
          <button
            onClick={() => setActiveTab('eo')}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
              activeTab === 'eo' ? "bg-primary text-white shadow-md" : "bg-slate-100 text-slate-500"
            )}
          >
            EO
          </button>
        </div>

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
                className="group relative bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-primary/20 transition-colors"
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

                  <div className={cn(
                    "flex-1 min-w-0",
                    cols === 1 ? "pr-12" : "pr-0 pb-10"
                  )}>
                    <p className={cn(
                      "font-bold text-slate-900 line-clamp-2 leading-snug mb-1",
                      cols === 1 ? "text-base" : "text-[13px]"
                    )}>{video.title}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="truncate">{video.viewCount}</span>
                      <span>•</span>
                      <span className="truncate">{video.publishedTime}</span>
                    </div>
                  </div>
                </a>

                {session && (
                  <button
                    onClick={(e) => handleAddVideo(e, video)}
                    disabled={addingId === video.videoId}
                    className={cn(
                      "absolute z-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-90 disabled:opacity-50",
                      cols === 1 ? "right-3 bottom-4 size-10" : "right-2 bottom-2 size-8"
                    )}
                    title="내 서재에 추가"
                  >
                    {addingId === video.videoId ? (
                      <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-xl">library_add</span>
                    )}
                  </button>
                )}
              </div>
            );})}
          </div>
        )}
      </main>

      <BottomNav activeTab="recommend" />
    </div>
  );
}
