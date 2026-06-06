'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, memo, useMemo } from 'react';
import { saveBook, addYes24Tab, deleteYes24Tab, updateYes24TabOrder } from '@/lib/db';
import { cn, getLongPressHandlers } from '@/lib/utils';
import { showToast } from '@/components/Toast';
import TabManagementModal from '@/components/TabManagementModal';
import BookGrid from '@/components/BookGrid';
import { Book } from '@/types/book';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ViewModeToggle from '@/components/ViewModeToggle';

interface BestBook {
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  price: string;
  coverImage: string;
  yes24Url: string;
}

export const SkeletonBestItem = memo(() => (
  <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl shadow-sm p-3 flex items-center gap-4">
    <div className="w-20 h-28 bg-slate-100 dark:bg-slate-800 rounded-lg animate-skeleton shrink-0" />
    <div className="flex-1 space-y-3">
      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-3/4" />
      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-1/2" />
      <div className="flex gap-2">
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-1/4" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-1/5" />
      </div>
    </div>
  </div>
));

export default function BestClient({
  session,
  initialTabs,
  initialBooks,
  isDev,
  actions,
}: {
  session: any;
  initialTabs: any[];
  initialBooks: Book[];
  isDev: boolean;
  actions: {
    batchDeleteBooks: (ids: string[]) => Promise<{ success: boolean; error?: string }>;
  };
}) {
  const router = useRouter();
  const [books, setBooks] = useState<BestBook[]>([]);
  const [myBooks, setMyBooks] = useState<Book[]>(initialBooks);
  const [isLoading, setIsLoading] = useState(true);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set(initialBooks.map(b => b.yes24Url).filter(Boolean) as string[]));
  const [viewMode, setViewMode] = useState<'my' | 'recommend'>('my');

  const [tabs, setTabs] = useState<any[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showTabManager, setShowTabManager] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bookView, setBookView] = useState('2');

  useEffect(() => {
    const savedTab = localStorage.getItem('yes24_active_tab');
    if (savedTab && tabs.some(t => t.id === savedTab)) {
        setActiveTabId(savedTab);
    } else if (tabs.length > 0) {
        setActiveTabId(tabs[0].id);
    }

    const savedViewMode = localStorage.getItem('yes24_view_mode');
    if (savedViewMode === 'my' || savedViewMode === 'recommend') {
        setViewMode(savedViewMode);
    }

    const savedBookView = localStorage.getItem('book-view');
    if (savedBookView) setBookView(savedBookView);
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
        localStorage.setItem('yes24_active_tab', activeTabId);
    }
  }, [activeTabId]);

  useEffect(() => {
    localStorage.setItem('yes24_view_mode', viewMode);
  }, [viewMode]);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchBest() {
      if (!activeTabId || viewMode !== 'recommend') {
        if (viewMode === 'recommend') setBooks([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        let fetchUrl = `/api/best?category=${activeTabId}`;

        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab) {
            fetchUrl = `/api/best?url=${encodeURIComponent(activeTab.url)}`;
        }

        const res = await fetch(fetchUrl);
        const data = await res.json();
        if (Array.isArray(data)) {
          setBooks(data);
        } else {
          setBooks([]);
        }
      } catch (err) {
        console.error(err);
        setBooks([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBest();
  }, [activeTabId, tabs, viewMode]);

  const handleAddBook = async (e: React.MouseEvent, book: BestBook, idx: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      showToast('로그인이 필요한 서비스입니다.', 'info');
      return;
    }

    setAddingId(idx);
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: book.yes24Url }),
      });

      if (!response.ok) throw new Error('Failed to extract details');
      const fullDetail = await response.json();

      const saveRes = await saveBook({
        title: fullDetail.title || book.title,
        author: fullDetail.author || book.author,
        coverImage: fullDetail.coverImage || book.coverImage || 'https://image.yes24.com/momo/Noimg_L.jpg',
        category: fullDetail.category || book.publisher,
        publishDate: fullDetail.publishDate || book.publishDate,
        price: fullDetail.price || book.price,
        description: fullDetail.description,
        readingStatus: 'READING',
        progress: 0,
        yes24Url: book.yes24Url
      });

      if (saveRes.success && saveRes.data) {
        setSavedUrls(prev => new Set([...Array.from(prev), book.yes24Url]));
        showToast('내 서재에 추가되었습니다.');
        setMyBooks(prev => [saveRes.data!, ...prev]);
      } else {
        showToast(saveRes.error || '저장 실패', 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('서재 추가에 실패했습니다.', 'error');
    } finally {
      setAddingId(null);
    }
  };

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
      const result = await actions.batchDeleteBooks(selectedIds);

      if (result.success) {
        showToast('삭제되었습니다.');
        setMyBooks(prev => prev.filter(b => !selectedIds.includes(b.id)));
        setSelectedIds([]);
        setIsEditMode(false);
      } else {
        showToast(`삭제 실패: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Batch delete error:', error);
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddTab = async () => {
    if (!newTabName || !newTabUrl) return;
    setIsAddingTab(true);
    const res = await addYes24Tab(newTabName, newTabUrl);
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
    const res = await deleteYes24Tab(id);
    if (res.success) {
      if (activeTabId === id) setActiveTabId(tabs.find(t => t.id !== id)?.id || null);
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
    const res = await updateYes24TabOrder(orders);
    if (!res.success) {
      showToast(res.error || '저장 실패', 'error');
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="Yes24"
        transparent
        rightAction={
            <div className="flex items-center gap-1">
                {viewMode === 'my' ? (
                    isEditMode ? (
                        <button
                          onClick={() => { setIsEditMode(false); setSelectedIds([]); }}
                          className="px-3 py-1 bg-primary text-white rounded-full text-xs font-bold mr-2"
                        >
                          취소
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (bookView === '2') updateBookView('3');
                                else if (bookView === '3') updateBookView('5');
                                else updateBookView('2');
                            }}
                            className="text-primary p-2"
                        >
                            <span className="material-symbols-outlined text-2xl">
                                {bookView === '2' ? 'grid_view' : (bookView === '3' ? 'view_module' : 'view_comfy')}
                            </span>
                        </button>
                    )
                ) : (
                    <button
                        onClick={() => setShowTabManager(!showTabManager)}
                        className="text-primary p-2"
                    >
                        <span className="material-symbols-outlined text-2xl">{showTabManager ? 'close' : 'add_circle'}</span>
                    </button>
                )}
            </div>
        }
      >
          <ViewModeToggle
            title="Yes24"
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
      </Header>

      <main className="mt-4 px-4">

        {viewMode === 'recommend' ? (
        <>
        {/* Source Tabs */}
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
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">베스트셀러 URL 추가</p>
            <input
              type="text"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              placeholder="탭 이름 (예: 자기계발)"
              className="w-full rounded-xl border dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={newTabUrl}
              onChange={(e) => setNewTabUrl(e.target.value)}
              placeholder="Yes24 베스트 URL"
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
        ) : books.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-600">
            <p>베스트셀러 정보를 불러올 수 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {books.map((book, idx) => (
              <BestBookItem
                key={idx}
                book={book}
                idx={idx}
                isLoggedIn={!!session}
                addingId={addingId}
                isSaved={savedUrls.has(book.yes24Url)}
                onAdd={handleAddBook}
              />
            ))}
          </div>
        )}
        </>
        ) : (
            <div className="space-y-6 pb-20">
                {!session?.user && !isDev ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-4xl text-primary">lock</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">로그인이 필요합니다</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 px-8">서재를 이용하고 독서 기록을 남기려면 먼저 로그인해 주세요.</p>
                        <Link
                            href="/login"
                            className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
                        >
                            로그인하기
                        </Link>
                    </div>
                ) : (
                    myBooks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
                            <span className="material-symbols-outlined text-6xl mb-4">library_books</span>
                            <p>아직 등록된 책이 없습니다.</p>
                            <Link href="/add?tab=yes24" className="text-primary text-sm font-bold mt-2">새 책 추가하기</Link>
                        </div>
                    ) : (
                        <BookGrid
                            books={myBooks}
                            viewMode={bookView}
                            isSelectionMode={isEditMode}
                            selectedIds={selectedIds}
                            onToggleSelection={toggleSelection}
                            onLongPress={handleLongPress}
                        />
                    )
                )}
            </div>
        )}
      </main>

      {/* Selection Mode Action Bar */}
      {isEditMode && selectedIds.length > 0 && viewMode === 'my' && (
        <div className="fixed bottom-[88px] left-0 right-0 p-4 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-t border-primary/10 z-40 animate-in slide-in-from-bottom duration-300">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              <span className="text-primary">{selectedIds.length}</span>개 선택됨
            </p>
            <button
              onClick={handleBatchDelete}
              disabled={isDeleting}
              className="px-6 py-2.5 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              {isDeleting ? '삭제 중...' : '삭제하기'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Add Button */}
      {!isEditMode && viewMode === 'my' && (session?.user || isDev) && (
        <Link
          href="/add?tab=yes24"
          className="fixed bottom-24 right-6 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-transform z-20"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </Link>
      )}

      <BottomNav activeTab="yes24" />

      <TabManagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tabs={tabs}
        onReorder={moveTab}
        onDelete={handleDeleteTab}
        onSave={saveTabOrder}
        title="Yes24 탭 관리"
      />
    </div>
  );
}

const BestBookItem = memo(({ book, idx, isLoggedIn, addingId, isSaved, onAdd }: any) => (
  <div className="group relative bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-primary/10 rounded-2xl shadow-sm hover:border-primary/20 transition-colors animate-fade-in-up">
    <a
      href={book.yes24Url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 p-3 pr-12 rounded-2xl"
    >
      <div className="relative shrink-0">
        <div
          className="w-20 h-28 bg-center bg-no-repeat bg-cover rounded-lg border border-slate-50 shadow-sm"
          style={{ backgroundImage: `url("${book.coverImage}")` }}
        />
        <div className="absolute -top-2 -left-2 size-6 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
          {idx + 1}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug mb-1">{book.title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{book.author} · {book.publisher}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-slate-400 dark:text-slate-500">{book.publishDate}</p>
          <p className="text-xs font-bold text-primary">{book.price}</p>
        </div>
      </div>
    </a>

    {isLoggedIn && (
      <button
        onClick={(e) => { if (!isSaved) onAdd(e, book, idx); }}
        disabled={addingId === idx || isSaved}
        className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 z-10 size-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-50",
            isSaved
                ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
                : "bg-primary/10 text-primary hover:bg-primary hover:text-white active:scale-90"
        )}
        title={isSaved ? "이미 저장됨" : "내 서재에 추가"}
      >
        {addingId === idx ? (
          <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="material-symbols-outlined text-xl">{isSaved ? 'task_alt' : 'library_add'}</span>
        )}
      </button>
    )}
  </div>
));
