'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import YoutubeGrid from '@/components/YoutubeGrid';
import QueueStatus from '@/components/QueueStatus';

export default function YoutubeRecordsClient({
  session,
  initialVideos
}: {
  session: any;
  initialVideos: any[];
}) {
  const [gridCols, setGridCols] = useState<'1' | '2'>('2');

  useEffect(() => {
    const savedCols = localStorage.getItem('youtube_grid_cols');
    if (savedCols === '1' || savedCols === '2') {
      setGridCols(savedCols as '1' | '2');
    }
  }, []);

  const toggleCols = () => {
    const next = gridCols === '1' ? '2' : '1';
    setGridCols(next);
    localStorage.setItem('youtube_grid_cols', next);
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="유튜브 기록"
        rightAction={
          <button
            onClick={toggleCols}
            className="text-primary p-2"
            title={gridCols === '1' ? "2열 보기" : "1열 보기"}
          >
            <span className="material-symbols-outlined text-2xl">
              {gridCols === '1' ? 'grid_view' : 'view_stream'}
            </span>
          </button>
        }
      />

      <main className="mt-6 px-4">
        <QueueStatus type="youtube" />
        {!session?.user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-primary">lock</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">로그인이 필요합니다</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 px-8">유튜브 기록을 보려면 먼저 로그인해 주세요.</p>
            <Link
              href="/login"
              className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
            >
              로그인하기
            </Link>
          </div>
        ) : initialVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
            <span className="material-symbols-outlined text-6xl mb-4">video_library</span>
            <p>아직 저장된 영상이 없습니다.</p>
            <p className="text-sm">새로운 영상을 추가해 보세요!</p>
          </div>
        ) : (
          <YoutubeGrid
            videos={initialVideos}
            viewMode={gridCols}
          />
        )}
      </main>

      <BottomNav activeTab="library" />
    </div>
  );
}
