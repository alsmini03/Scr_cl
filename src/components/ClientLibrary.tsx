'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import BookGrid from '@/components/BookGrid';
import YoutubeGrid from '@/components/YoutubeGrid';
import { Book } from '@/types/book';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface YoutubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  published_at: string;
}

interface ClientLibraryProps {
  session: any;
  books: Book[];
  youtubeVideos: YoutubeVideo[];
  mode: string;
  youtubeView: string;
  isDev: boolean;
  actions: {
    batchDeleteBooks: (ids: string[]) => Promise<{ success: boolean; error?: string }>;
    batchDeleteYoutubeVideos: (ids: string[]) => Promise<{ success: boolean; error?: string }>;
  };
}

export default function ClientLibrary({
  session,
  books,
  youtubeVideos,
  mode: initialMode,
  youtubeView: initialYoutubeView,
  isDev,
  actions
}: ClientLibraryProps) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [youtubeView, setYoutubeView] = useState(initialYoutubeView);
  const [bookView, setBookView] = useState('3');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync with initial props and localStorage
  useEffect(() => {
    const savedBookView = localStorage.getItem('book-view');
    if (savedBookView) setBookView(savedBookView);

    const savedYoutubeView = localStorage.getItem('youtube-view');
    if (savedYoutubeView) setYoutubeView(savedYoutubeView);

    const savedMode = localStorage.getItem('library-mode');
    if (savedMode && (savedMode === 'books' || savedMode === 'youtube')) {
      setMode(savedMode);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('library-mode', mode);
  }, [mode]);

  const updateBookView = (view: string) => {
    setBookView(view);
    localStorage.setItem('book-view', view);
  };

  const handleLongPress = (id: string) => {
    if (!isEditMode) {
      setIsEditMode(true);
      setSelectedIds([id]);
    }
  };

  const updateYoutubeView = (view: string) => {
    setYoutubeView(view);
    localStorage.setItem('youtube-view', view);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`${selectedIds.length}개의 항목을 삭제하시겠습니까?`)) return;

    setIsDeleting(true);
    try {
      let result;
      if (mode === 'books') {
        result = await actions.batchDeleteBooks(selectedIds);
      } else {
        result = await actions.batchDeleteYoutubeVideos(selectedIds);
      }

      if (result.success) {
        alert('삭제되었습니다.');
        setSelectedIds([]);
        setIsEditMode(false);
        router.refresh();
      } else {
        alert(`삭제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Batch delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasItems = mode === 'books' ? books.length > 0 : youtubeVideos.length > 0;

  return (
    <div className="font-display min-h-screen pb-32 bg-white">
      <Header
        title="내 서재"
        transparent
        rightAction={
          <div className="flex items-center gap-1">
            {!isEditMode && mode === 'youtube' && (session?.user || isDev) && (
              <Link href="/add/youtube" className="flex size-10 items-center justify-center text-primary">
                <span className="material-symbols-outlined text-2xl">add</span>
              </Link>
            )}
            {hasItems && (
              <button
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  setSelectedIds([]);
                }}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold transition-all",
                  isEditMode ? "bg-primary text-white" : "bg-primary/10 text-primary"
                )}
              >
                {isEditMode ? '취소' : '삭제'}
              </button>
            )}
            {!isEditMode && (
              mode === 'books' ? (
                <button
                  onClick={() => updateBookView(bookView === '3' ? '5' : '3')}
                  className="flex size-10 items-center justify-center text-primary"
                >
                  <span className="material-symbols-outlined text-2xl">
                    {bookView === '3' ? 'grid_view' : 'view_comfy'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => updateYoutubeView(youtubeView === '1' ? '2' : '1')}
                  className="flex size-10 items-center justify-center text-primary"
                >
                  <span className="material-symbols-outlined text-2xl">
                    {youtubeView === '1' ? 'grid_view' : 'view_stream'}
                  </span>
                </button>
              )
            )}
          </div>
        }
      />

      <main className="mt-6 px-4">
        {/* Toggle Mode */}
        {!isEditMode && (
          <div className="flex gap-2 mb-8 p-1 bg-slate-100 rounded-xl max-w-xs mx-auto">
            <button
              onClick={() => {
                setMode('books');
                router.push('/?mode=books', { scroll: false });
              }}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all text-center",
                mode === 'books' ? "bg-white text-primary shadow-sm" : "text-slate-500"
              )}
            >
              도서
            </button>
            <button
              onClick={() => {
                setMode('youtube');
                router.push('/?mode=youtube', { scroll: false });
              }}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all text-center",
                mode === 'youtube' ? "bg-white text-primary shadow-sm" : "text-slate-500"
              )}
            >
              유튜브
            </button>
          </div>
        )}

        {!session?.user && !isDev ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-primary">lock</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">로그인이 필요합니다</h3>
            <p className="text-slate-500 mb-8 px-8">서재를 이용하고 독서 기록을 남기려면 먼저 로그인해 주세요.</p>
            <Link
              href="/login"
              className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
            >
              로그인하기
            </Link>
          </div>
        ) : mode === 'books' ? (
           books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
              <span className="material-symbols-outlined text-6xl mb-4">library_books</span>
              <p>아직 등록된 책이 없습니다.</p>
              <Link href="/add" className="text-primary text-sm font-bold mt-2">새 책 추가하기</Link>
            </div>
          ) : (
            <BookGrid
              books={books}
              viewMode={bookView}
              isSelectionMode={isEditMode}
              selectedIds={selectedIds}
              onToggleSelection={toggleSelection}
              onLongPress={handleLongPress}
            />
          )
        ) : (
          youtubeVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
              <span className="material-symbols-outlined text-6xl mb-4">video_library</span>
              <p>저장된 유튜브 영상이 없습니다.</p>
              <Link href="/add/youtube" className="text-primary text-sm font-bold mt-2">유튜브 정보 가져오기</Link>
            </div>
          ) : (
            <YoutubeGrid
              videos={youtubeVideos}
              viewMode={youtubeView}
              isSelectionMode={isEditMode}
              selectedIds={selectedIds}
              onToggleSelection={toggleSelection}
              onLongPress={handleLongPress}
            />
          )
        )}
      </main>

      {/* Fixed Bottom Action Bar for Selection Mode */}
      {isEditMode && selectedIds.length > 0 && (
        <div className="fixed bottom-[88px] left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 z-40 animate-in slide-in-from-bottom duration-300">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">
              <span className="text-primary">{selectedIds.length}</span>개 선택됨
            </p>
            <button
              onClick={handleBatchDelete}
              disabled={isDeleting}
              className="px-6 py-2.5 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              {isDeleting ? '삭제 중...' : '삭제하기'}
            </button>
          </div>
        </div>
      )}

      {!isEditMode && mode === 'books' && (session?.user || isDev) && (
        <Link
          href="/add"
          className="fixed bottom-24 right-6 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-transform z-20"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </Link>
      )}

      <BottomNav activeTab="home" />
    </div>
  );
}
