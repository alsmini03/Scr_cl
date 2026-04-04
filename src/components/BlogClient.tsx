'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, memo } from 'react';
import { saveBlog, deleteBlog, addBlogTab, deleteBlogTab, updateBlogTabOrder, batchDeleteBlogsAction as batchDeleteBlogs } from '@/lib/db';
import { cn, formatDateToYMD, getLongPressHandlers } from '@/lib/utils';
import Link from 'next/link';
import TabManagementModal from '@/components/TabManagementModal';
import ViewModeToggle from '@/components/ViewModeToggle';

export default function BlogClient({
  session,
  initialBlogs,
  initialTabs,
}: {
  session: any;
  initialBlogs: any[];
  initialTabs: any[];
}) {
  const [blogs, setBlogs] = useState<any[]>(initialBlogs);
  const [recommendPosts, setRecommendPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingUrl, setAddingUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'my' | 'recommend'>('my');

  const [tabs, setTabs] = useState<any[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showTabManager, setShowTabManager] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchRecommend = async () => {
    if (tabs.length === 0 && activeTabId === 'all') {
      setRecommendPosts([]);
      return;
    }

    setIsLoading(true);
    try {
      let fetchUrl = '/api/blog/list';
      if (activeTabId === 'all') {
        const allSources = tabs.map(t => t.url).join(',');
        if (allSources) {
          fetchUrl += `?blogId=${encodeURIComponent(allSources)}`;
        } else {
            setRecommendPosts([]);
            setIsLoading(false);
            return;
        }
      } else {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab) {
          fetchUrl += `?blogId=${encodeURIComponent(activeTab.url)}`;
        }
      }

      const res = await fetch(fetchUrl);
      const data = await res.json();
      setRecommendPosts(data.posts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedTab = localStorage.getItem('blog_recommend_tab');
    if (savedTab && tabs.some(t => t.id === savedTab)) {
      setActiveTabId(savedTab);
    } else {
      setActiveTabId('all');
    }

    const savedViewMode = localStorage.getItem('blog_view_mode');
    if (savedViewMode === 'my' || savedViewMode === 'recommend') {
      setViewMode(savedViewMode);
    }
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem('blog_recommend_tab', activeTabId);
    }
  }, [activeTabId]);

  useEffect(() => {
    localStorage.setItem('blog_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'recommend' && activeTabId) {
        fetchRecommend();
    }
  }, [activeTabId, tabs, viewMode]);

  const handleAddBlog = async (post: any) => {
    if (!session) {
      alert('로그인이 필요합니다.');
      return;
    }

    setAddingUrl(post.url);
    try {
      const res = await fetch('/api/blog/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: post.url })
      });
      const data = await res.json();

      const saveRes = await saveBlog({
        title: data.title || post.title,
        author: data.author || post.author,
        url: post.url,
        thumbnail: data.thumbnail || post.thumbnail,
        content: data.content,
        published_at: data.published_at || post.published_at
      });

      if (saveRes.success && saveRes.id) {
        alert('블로그 글이 저장되었습니다.');
        // Refresh library locally
        setBlogs(prev => [{
            id: saveRes.id,
            title: data.title || post.title,
            author: data.author || post.author,
            url: post.url,
            thumbnail: data.thumbnail || post.thumbnail,
            published_at: data.published_at || post.published_at,
            added_at: new Date().toISOString()
        }, ...prev]);
      } else {
        alert(saveRes.error);
      }
    } catch (err) {
      alert('저장에 실패했습니다.');
    } finally {
      setAddingUrl(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('정말로 삭제하시겠습니까?')) return;
      const res = await deleteBlog(id);
      if (res.success) {
          setBlogs(prev => prev.filter(b => b.id !== id));
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
    if (!confirm(`선택한 ${selectedIds.length}개의 글을 삭제하시겠습니까?`)) return;

    setIsLoading(true);
    const res = await batchDeleteBlogs(selectedIds);
    if (res.success) {
        setIsEditMode(false);
        setBlogs(prev => prev.filter(b => !selectedIds.includes(b.id)));
        setSelectedIds([]);
    } else {
        alert(res.error);
    }
    setIsLoading(false);
  };

  const handleAddTab = async () => {
    if (!newTabName || !newTabUrl) return;
    setIsAddingTab(true);
    const res = await addBlogTab(newTabName, newTabUrl);
    if (res.success && res.id) {
      setNewTabName('');
      setNewTabUrl('');
      localStorage.setItem('blog_recommend_tab', res.id);
      window.location.reload();
    } else {
      alert(res.error);
    }
    setIsAddingTab(false);
  };

  const handleDeleteTab = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('탭을 삭제하시겠습니까?')) return;
    const res = await deleteBlogTab(id);
    if (res.success) {
      if (activeTabId === id) setActiveTabId('all');
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
    const res = await updateBlogTabOrder(orders);
    if (!res.success) {
      alert(res.error);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="블로그"
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
                            onClick={() => window.location.href = '/add?tab=blog'}
                            className="text-primary p-2"
                        >
                            <span className="material-symbols-outlined text-2xl">add_circle</span>
                        </button>
                    </>
                )}
            </div>
        }
      >
          <ViewModeToggle
            title="블로그"
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
      </Header>

      <main className="mt-4 px-4">

        {isEditMode && viewMode === 'my' && (
            <div className="mb-6 flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
                <p className="text-sm font-bold text-red-600 dark:text-red-400 ml-2">
                    {selectedIds.length}개 선택됨
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSelectedIds(selectedIds.length === blogs.length ? [] : blogs.map(b => b.id))}
                        className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                        {selectedIds.length === blogs.length ? '전체 해제' : '전체 선택'}
                    </button>
                    <button
                        onClick={handleBatchDelete}
                        disabled={selectedIds.length === 0}
                        className="px-4 py-1.5 text-xs font-bold bg-red-500 text-white rounded-lg shadow-sm disabled:opacity-50"
                    >
                        삭제하기
                    </button>
                </div>
            </div>
        )}

        {viewMode === 'recommend' ? (
            <>
            {/* Blog Source Tabs */}
            <div className={cn(
                "flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-20"
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
                                    fetchRecommend();
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
                                            fetchRecommend();
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
                        );
                    })}
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
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">블로그 추가</p>
                    <input
                        type="text"
                        value={newTabName}
                        onChange={(e) => setNewTabName(e.target.value)}
                        placeholder="블로그 이름 (예: 토트카)"
                        className="w-full rounded-xl border dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <input
                        type="text"
                        value={newTabUrl}
                        onChange={(e) => setNewTabUrl(e.target.value)}
                        placeholder="블로그 URL (예: https://m.blog.naver.com/totcar)"
                        className="w-full rounded-xl border dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <button
                        onClick={handleAddTab}
                        disabled={isAddingTab || !newTabName || !newTabUrl}
                        className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-50"
                    >
                        {isAddingTab ? '추가 중...' : '블로그 추가하기'}
                    </button>
                </div>
            )}
            {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-2xl h-24 w-full animate-skeleton" />
                  ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {recommendPosts.map((post, idx) => (
                        <RecommendItem
                          key={idx}
                          post={post}
                          addingUrl={addingUrl}
                          onAdd={handleAddBlog}
                        />
                    ))}
                </div>
            )
            }
            </>
        ) : (
            blogs.length === 0 ? (
                <div className="py-20 text-center text-slate-400">저장된 글이 없습니다.</div>
            ) : (
                <div className="space-y-3 pb-20">
                    {blogs.map((blog) => (
                      <MyBlogItem
                        key={blog.id}
                        blog={blog}
                        isEditMode={isEditMode}
                        isSelected={selectedIds.includes(blog.id)}
                        onLongPress={handleLongPress}
                        onToggleSelect={toggleSelect}
                        onDelete={handleDelete}
                      />
                    ))}
                </div>
            )
        )}
      </main>

      <BottomNav activeTab="blog" />

      <TabManagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tabs={tabs}
        onReorder={moveTab}
        onDelete={handleDeleteTab}
        onSave={saveTabOrder}
        title="블로그 탭 관리"
      />
    </div>
  );
}

const RecommendItem = memo(({ post, addingUrl, onAdd }: any) => (
  <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 overflow-hidden shadow-sm flex items-center pr-3 animate-fade-in-up">
      <a href={post.url} target="_blank" rel="noopener" className="flex-1 p-4 min-w-0">
          <div className="flex flex-col justify-center">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight mb-1.5">{post.title}</h3>
              <div className="flex justify-between items-center">
                  {post.author && <p className="text-[10px] text-primary font-bold mr-2 truncate">{post.author}</p>}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {formatDateToYMD(post.published_at)}
                  </p>
              </div>
          </div>
      </a>
      <button
          onClick={() => onAdd(post)}
          disabled={addingUrl === post.url}
          className="size-10 flex-shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all disabled:opacity-50"
      >
          {addingUrl === post.url ? <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined">library_add</span>}
      </button>
  </div>
));

const MyBlogItem = memo(({ blog, isEditMode, isSelected, onLongPress, onToggleSelect, onDelete }: any) => {
  const longPressHandlers = getLongPressHandlers(() => onLongPress(blog.id), 500);

  return (
      <div className="relative animate-fade-in-up">
          <Link
              href={isEditMode ? '#' : `/blog/${blog.id}`}
              onClick={(e) => isEditMode && onToggleSelect(blog.id, e)}
              {...longPressHandlers}
              className={cn(
                  "flex bg-white dark:bg-slate-900/50 rounded-2xl border overflow-hidden shadow-sm active:scale-[0.98] transition-all relative group",
                  isEditMode && isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-100 dark:border-primary/10"
              )}
          >
              <div className="flex-1 p-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-2 leading-tight">{blog.title}</h3>
                  <div className="flex justify-between items-center mt-1">
                      {blog.author && <p className="text-[10px] text-primary font-bold mr-2 truncate">{blog.author}</p>}
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {formatDateToYMD(blog.published_at)}
                      </p>
                  </div>
              </div>
              <div className="flex items-center pr-3">
                  {isEditMode ? (
                      <div className={cn(
                          "size-6 rounded-full border-2 flex items-center justify-center transition-all",
                          isSelected ? "bg-primary border-primary" : "border-slate-200 dark:border-slate-700"
                      )}>
                          {isSelected && <span className="material-symbols-outlined text-white text-sm font-bold">check</span>}
                      </div>
                  ) : (
                      <button
                          onClick={(e) => onDelete(blog.id, e)}
                          className="size-10 text-slate-300 hover:text-red-500 transition-colors"
                      >
                          <span className="material-symbols-outlined">delete</span>
                      </button>
                  )}
              </div>
          </Link>
      </div>
  );
});
