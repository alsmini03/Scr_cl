'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, memo } from 'react';
import { saveBook, addYes24Tab, deleteYes24Tab, updateYes24TabOrder } from '@/lib/db';
import { cn } from '@/lib/utils';
import TabManagementModal from '@/components/TabManagementModal';

interface BestBook {
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  price: string;
  coverImage: string;
  yes24Url: string;
}

export default function BestClient({
  session,
  initialTabs,
}: {
  session: any;
  initialTabs: any[];
}) {
  const [books, setBooks] = useState<BestBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingId, setAddingId] = useState<number | null>(null);

  const [tabs, setTabs] = useState<any[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showTabManager, setShowTabManager] = useState(false);

  useEffect(() => {
    const savedTab = localStorage.getItem('yes24_active_tab');
    if (savedTab && tabs.some(t => t.id === savedTab)) {
        setActiveTabId(savedTab);
    } else if (tabs.length > 0) {
        setActiveTabId(tabs[0].id);
    }
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
        localStorage.setItem('yes24_active_tab', activeTabId);
    }
  }, [activeTabId]);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchBest() {
      if (!activeTabId) {
        setBooks([]);
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
  }, [activeTabId, tabs]);

  const handleAddBook = async (e: React.MouseEvent, book: BestBook, idx: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      alert('로그인이 필요한 서비스입니다.');
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

      await saveBook({
        title: fullDetail.title || book.title,
        author: fullDetail.author || book.author,
        coverImage: fullDetail.coverImage || book.coverImage || 'https://image.yes24.com/momo/Noimg_L.jpg',
        category: fullDetail.category || book.publisher,
        publishDate: fullDetail.publishDate || book.publishDate,
        price: fullDetail.price || book.price,
        description: fullDetail.description,
        readingStatus: 'READING',
        progress: 0,
      });

      alert(`'${book.title}'이(가) 상세 정보와 함께 서재에 추가되었습니다.`);
    } catch (error) {
      console.error(error);
      alert('서재 추가에 실패했습니다.');
    } finally {
      setAddingId(null);
    }
  };

  const handleAddTab = async () => {
    if (!newTabName || !newTabUrl) return;
    setIsAddingTab(true);
    const res = await addYes24Tab(newTabName, newTabUrl);
    if (res.success && res.id) {
      setNewTabName('');
      setNewTabUrl('');
      localStorage.setItem('yes24_active_tab', res.id);
      window.location.reload();
    } else {
      alert(res.error);
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
      alert(res.error);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="Yes24 베스트 100"
        transparent
        rightAction={
            <button
                onClick={() => setShowTabManager(!showTabManager)}
                className="text-primary p-2"
            >
                <span className="material-symbols-outlined text-2xl">{showTabManager ? 'close' : 'add_circle'}</span>
            </button>
        }
      />

      <main className="mt-4 px-4">
        {/* Source Tabs */}
        <div className="flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-10">
          <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 py-2">
            {tabs.map(tab => {
                let timer: any;
                const handleTouchStart = () => { timer = setTimeout(() => handleTabLongPress(tab.id), 600); };
                const handleTouchEnd = () => { clearTimeout(timer); };
                return (
                    <div
                        key={tab.id}
                        className="relative flex-shrink-0 group transition-all"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={handleTouchStart}
                        onMouseUp={handleTouchEnd}
                    >
                        <button
                            onClick={() => setActiveTabId(tab.id)}
                            className={cn(
                                "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                                activeTabId === tab.id ? "bg-primary text-white shadow-md" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
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
                onAdd={handleAddBook}
              />
            ))}
          </div>
        )}
      </main>

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

const BestBookItem = memo(({ book, idx, isLoggedIn, addingId, onAdd }: any) => (
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
        onClick={(e) => onAdd(e, book, idx)}
        disabled={addingId === idx}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 size-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-90 disabled:opacity-50"
        title="내 서재에 추가"
      >
        {addingId === idx ? (
          <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="material-symbols-outlined text-xl">library_add</span>
        )}
      </button>
    )}
  </div>
));
