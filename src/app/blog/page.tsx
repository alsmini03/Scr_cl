'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState } from 'react';
import { saveBlog, getBlogs, deleteBlog, getBlogTabs, addBlogTab, deleteBlogTab, updateBlogTabOrder } from '@/lib/db';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function BlogListPage() {
  const { data: session } = useSession();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [recommendPosts, setRecommendPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingUrl, setAddingUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'my' | 'recommend'>('recommend');

  const [tabs, setTabs] = useState<any[]>([]);
  const [activeTabId, setActiveTabId] = useState('all');
  const [showTabManager, setShowTabManager] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const loadMyBlogs = async () => {
    const data = await getBlogs();
    setBlogs(data);
  };

  const loadTabs = async () => {
    const dbTabs = await getBlogTabs();
    setTabs(dbTabs);
  };

  const fetchRecommend = async () => {
    if (tabs.length === 0 && activeTabId === 'all') {
      setRecommendPosts([]);
      setIsLoading(false);
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
    loadMyBlogs();
    loadTabs();
  }, []);

  useEffect(() => {
    if (viewMode === 'recommend') {
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

      if (saveRes.success) {
        alert('블로그 글이 저장되었습니다.');
        await loadMyBlogs();
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
          loadMyBlogs();
      }
  };

  const handleAddTab = async () => {
    if (!newTabName || !newTabUrl) return;
    setIsAddingTab(true);
    const res = await addBlogTab(newTabName, newTabUrl);
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
    const res = await deleteBlogTab(id);
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
    const res = await updateBlogTabOrder(orders);
    if (res.success) {
      setIsReordering(false);
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="블로그"
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
                            onClick={() => window.location.href = '/add?tab=blog'}
                            className="text-primary p-2"
                        >
                            <span className="material-symbols-outlined text-2xl">add_circle</span>
                        </button>
                    </>
                )}
            </div>
        }
      />

      <main className="mt-4 px-4">
        {/* Toggle View Mode */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-200 dark:bg-slate-800 rounded-xl max-w-xs mx-auto">
            <button
              onClick={() => { setViewMode('recommend'); setIsReordering(false); }}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-bold transition-all text-center",
                viewMode === 'recommend' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
            >
              추천
            </button>
            <button
              onClick={() => { setViewMode('my'); setIsReordering(false); }}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-bold transition-all text-center",
                viewMode === 'my' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
            >
              내 보관함
            </button>
        </div>

        {viewMode === 'recommend' ? (
            <>
            {/* Blog Source Tabs */}
            <div className="flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-20">
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
                        const handleTouchStart = () => { timer = setTimeout(() => handleTabLongPress(tab.id), 600); };
                        const handleTouchEnd = () => { clearTimeout(timer); };
                        return (
                            <div
                                key={tab.id}
                                className={cn(
                                    "relative flex-shrink-0 group transition-all",
                                    isReordering && draggedId === tab.id ? "opacity-50 scale-95" : "opacity-100",
                                    isReordering && "animate-pulse"
                                )}
                                draggable={isReordering}
                                onDragStart={() => setDraggedId(tab.id)}
                                onDragEnd={() => setDraggedId(null)}
                                onDragOver={(e) => { e.preventDefault(); if (draggedId) moveTab(draggedId, tab.id); }}
                                onTouchStart={handleTouchStart}
                                onTouchEnd={handleTouchEnd}
                                onMouseDown={handleTouchStart}
                                onMouseUp={handleTouchEnd}
                            >
                                <button
                                    onClick={() => !isReordering && setActiveTabId(tab.id)}
                                    className={cn(
                                        "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                                        !isReordering && activeTabId === tab.id ? "bg-primary text-white shadow-md" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                                        isReordering && "cursor-move ring-2 ring-primary ring-offset-2 dark:ring-offset-background-dark pr-10"
                                    )}
                                >
                                    {isReordering && <span className="material-symbols-outlined text-[14px] mr-1 align-middle">drag_indicator</span>}
                                    {tab.name}
                                </button>
                                {isReordering && (
                                    <button
                                        onClick={(e) => handleDeleteTab(tab.id, e)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full bg-red-500 text-white shadow-sm z-10"
                                    >
                                        <span className="material-symbols-outlined text-[14px] font-bold">close</span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
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
                <div className="flex justify-center py-20"><div className="animate-spin text-primary"><span className="material-symbols-outlined text-4xl">sync</span></div></div>
            ) : (
                <div className="space-y-3">
                    {recommendPosts.map((post, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 overflow-hidden shadow-sm flex">
                            <a href={post.url} target="_blank" rel="noopener" className="flex-1 p-4">
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight mb-1.5">{post.title}</h3>
                                    <div className="flex justify-between items-center">
                                        {post.author && <p className="text-[10px] text-primary font-bold mr-2 truncate">{post.author}</p>}
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{post.published_at}</p>
                                    </div>
                                </div>
                            </a>
                            <div className="flex items-center pr-3">
                                <button
                                    onClick={() => handleAddBlog(post)}
                                    disabled={addingUrl === post.url}
                                    className="size-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                                >
                                    {addingUrl === post.url ? <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined">library_add</span>}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )
            }
            </>
        ) : (
            blogs.length === 0 ? (
                <div className="py-20 text-center text-slate-400">저장된 글이 없습니다.</div>
            ) : (
                <div className="space-y-3">
                    {blogs.map((blog) => (
                        <Link key={blog.id} href={`/blog/${blog.id}`} className="flex bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 overflow-hidden shadow-sm active:scale-[0.98] transition-all relative group">
                            <div className="flex-1 p-4">
                                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-2 leading-tight">{blog.title}</h3>
                                <div className="flex justify-between items-center mt-1">
                                    {blog.author && <p className="text-[10px] text-primary font-bold mr-2 truncate">{blog.author}</p>}
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{blog.published_at}</p>
                                </div>
                            </div>
                            <div className="flex items-center pr-3">
                                <button
                                    onClick={(e) => handleDelete(blog.id, e)}
                                    className="size-10 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        </Link>
                    ))}
                </div>
            )
        )}
      </main>

      <BottomNav activeTab="blog" />
    </div>
  );
}
