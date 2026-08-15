'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState, memo, useMemo, useRef, useCallback } from 'react';
import { saveBlog, addBlogTab, deleteBlogTab, updateBlogTabOrder, sendBatchEmailAction } from '@/lib/db';
import { cn, formatDateToYMD, getLongPressHandlers } from '@/lib/utils';
import { showToast } from '@/components/Toast';
import TabManagementModal from '@/components/TabManagementModal';

export default function BlogClient({
  session,
  initialTabs,
  initialSavedBlogs = []
}: {
  session: any;
  initialTabs: any[];
  initialSavedBlogs?: any[];
}) {
  const [recommendPosts, setRecommendPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingUrl, setAddingUrl] = useState<string | null>(null);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set(initialSavedBlogs.map(b => b.url)));

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const dragTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{x: number, y: number} | null>(null);

  const [tabs, setTabs] = useState<any[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showTabManager, setShowTabManager] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPromptOn, setIsPromptOn] = useState(false);

  useEffect(() => {
    const savedPrompt = localStorage.getItem('blog_prompt_enabled');
    if (savedPrompt !== null) {
      setIsPromptOn(savedPrompt === 'true');
    }
  }, []);

  const fetchRecommend = async () => {
    if (!activeTabId) {
      setRecommendPosts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let fetchUrl = '/api/blog/list';
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab) {
        fetchUrl += `?blogId=${encodeURIComponent(activeTab.url)}`;
      } else {
          setRecommendPosts([]);
          setIsLoading(false);
          return;
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
    } else if (tabs.length > 0) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem('blog_recommend_tab', activeTabId);
      fetchRecommend();
    }
  }, [activeTabId, tabs]);

  const handleAddBlog = async (post: any) => {
    if (!session) {
      showToast('로그인이 필요합니다.', 'info');
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

      if (isPromptOn) {
        showToast('AI 요약을 분석하는 중입니다...');
      }

      const saveRes = await saveBlog({
        title: data.title || post.title,
        author: data.author || post.author,
        url: post.url,
        thumbnail: data.thumbnail || post.thumbnail,
        content: data.content,
        published_at: data.published_at || post.published_at,
        includeAi: isPromptOn
      });

      if (saveRes.success && saveRes.id) {
        setSavedUrls(prev => new Set([...Array.from(prev), post.url]));
        showToast(saveRes.summary ? '내 서재에 저장되고 AI 요약이 완료되었습니다.' : '내 서재에 추가되었습니다.');
      } else {
        showToast(saveRes.error || '저장 실패', 'error');
      }
    } catch (err) {
      showToast('저장에 실패했습니다.', 'error');
    } finally {
      setAddingUrl(null);
    }
  };

  const handleAddTab = async () => {
    if (!newTabName || !newTabUrl) return;
    setIsAddingTab(true);
    const res = await addBlogTab(newTabName, newTabUrl);
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
    const res = await deleteBlogTab(id);
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
    const res = await updateBlogTabOrder(orders);
    if (!res.success) {
      showToast(res.error || '저장 실패', 'error');
    }
  };

  const toggleSelect = useCallback((url: string) => {
    setSelectedUrls(prev => {
        if (prev.includes(url)) {
            return prev.filter(u => u !== url);
        } else {
            return [...prev, url];
        }
    });
  }, []);

  const addSelect = useCallback((url: string) => {
    setSelectedUrls(prev => {
        if (prev.includes(url)) return prev;
        return [...prev, url];
    });
  }, []);

  const handlePointerDown = (e: React.PointerEvent, url: string) => {
    if (e.button !== 0) return;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    dragTimerRef.current = setTimeout(() => {
        setIsEditMode(true);
        setIsDragging(true);
        addSelect(url);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50);
        }
    }, 600);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
        const element = document.elementFromPoint(e.clientX, e.clientY);
        const itemElement = element?.closest('[data-blog-item="true"]');
        if (itemElement) {
            const url = itemElement.getAttribute('data-url');
            if (url) addSelect(url);
        }
    };

    const onPointerUp = () => {
        setIsDragging(false);
        startPosRef.current = null;
        if (dragTimerRef.current) {
            clearTimeout(dragTimerRef.current);
            dragTimerRef.current = null;
        }
        document.body.style.touchAction = '';
        document.body.style.userSelect = '';
    };

    document.body.style.touchAction = 'none';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        document.body.style.touchAction = '';
        document.body.style.userSelect = '';
    };
  }, [isDragging, addSelect]);

  const handlePointerMoveRoot = (e: React.PointerEvent) => {
    if (!startPosRef.current || isDragging) return;
    const dist = Math.sqrt(
        Math.pow(e.clientX - startPosRef.current.x, 2) +
        Math.pow(e.clientY - startPosRef.current.y, 2)
    );
    if (dist > 10) {
        if (dragTimerRef.current) {
            clearTimeout(dragTimerRef.current);
            dragTimerRef.current = null;
        }
    }
  };

  const handlePointerUpRoot = () => {
    if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current);
        dragTimerRef.current = null;
    }
    startPosRef.current = null;
  };

  const handleBatchEmail = async () => {
    if (selectedUrls.length === 0) return;
    setIsProcessing(true);
    try {
        const email = localStorage.getItem('last_blog_email') || 'seokmin.kwon@samsung.com';

        // Extract and Save selected posts first
        const savedIds: string[] = [];
        for (const url of selectedUrls) {
            const post = recommendPosts.find(p => p.url === url);
            if (!post) continue;

            // Check if already saved
            const existing = initialSavedBlogs.find(b => b.url === url);
            if (existing) {
                savedIds.push(existing.id);
                continue;
            }

            const res = await fetch('/api/blog/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            const saveRes = await saveBlog({
                title: data.title || post.title,
                author: data.author || post.author,
                url,
                thumbnail: data.thumbnail || post.thumbnail,
                content: data.content,
                published_at: data.published_at || post.published_at,
                includeAi: isPromptOn
            });
            if (saveRes.success && saveRes.id) {
                savedIds.push(saveRes.id);
            }
        }

        if (savedIds.length > 0) {
            const emailRes = await sendBatchEmailAction(
                savedIds.map(id => ({ type: 'blog', id })),
                email
            );
            if (emailRes.success) {
                showToast(`${savedIds.length}개의 글이 메일로 발송되었습니다.`);
                setIsEditMode(false);
                setSelectedUrls([]);
                // Update saved status locally
                setSavedUrls(prev => new Set([...Array.from(prev), ...selectedUrls]));
            } else {
                showToast(emailRes.error || '메일 발송 실패', 'error');
            }
        } else {
            showToast('처리된 글이 없습니다.', 'error');
        }
    } catch (err: any) {
        showToast(`오류 발생: ${err.message}`, 'error');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleBatchSave = async () => {
      if (selectedUrls.length === 0) return;
      setIsProcessing(true);
      try {
          let count = 0;
          for (const url of selectedUrls) {
              if (savedUrls.has(url)) continue;
              const post = recommendPosts.find(p => p.url === url);
              const res = await fetch('/api/blog/extract', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url })
              });
              const data = await res.json();

              const saveRes = await saveBlog({
                  title: data.title || post?.title,
                  author: data.author || post?.author,
                  url,
                  thumbnail: data.thumbnail || post?.thumbnail,
                  content: data.content,
                  published_at: data.published_at || post?.published_at,
                  includeAi: isPromptOn
              });
              if (saveRes.success) count++;
          }
          if (count > 0) {
              showToast(`${count}개의 글이 저장되었습니다.`);
              setSavedUrls(prev => new Set([...Array.from(prev), ...selectedUrls]));
          }
          setIsEditMode(false);
          setSelectedUrls([]);
      } catch (err) {
          showToast('저장 중 오류가 발생했습니다.', 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div
        className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100"
        onPointerMove={handlePointerMoveRoot}
        onPointerUp={handlePointerUpRoot}
        onPointerCancel={handlePointerUpRoot}
    >
      <Header
        title="블로그"
        rightAction={
            isEditMode ? (
                <button
                    onClick={() => { setIsEditMode(false); setSelectedUrls([]); }}
                    className="text-slate-500 font-bold px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg mr-2"
                >
                    취소
                </button>
            ) : (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => window.location.href = '/add?tab=blog'}
                        className="text-primary p-2"
                    >
                        <span className="material-symbols-outlined text-2xl">add_circle</span>
                    </button>
                </div>
            )
        }
      />

      <main className="mt-4 px-4">
            {/* Blog Source Tabs */}
            <div className={cn(
                "flex items-center gap-2 mb-6 -mx-4 px-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-20"
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
                                onContextMenu={(e) => e.preventDefault()}
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
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTab()}
                        placeholder="블로그 이름 (예: 토트카)"
                        className="w-full rounded-xl border dark:border-primary/20 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <input
                        type="text"
                        value={newTabUrl}
                        onChange={(e) => setNewTabUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTab()}
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

            {/* AI Prompt ON/OFF Toggle Bar */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900/50 rounded-2xl p-3.5 border border-slate-100 dark:border-primary/10 shadow-sm mb-4">
                <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                    <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">AI 프롬프트 분석</p>
                        <p className="text-[10px] text-slate-400">저장 시 설정된 프롬프트로 AI 요약을 함께 생성합니다.</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        const next = !isPromptOn;
                        setIsPromptOn(next);
                        localStorage.setItem('blog_prompt_enabled', String(next));
                        showToast(next ? 'AI 프롬프트 기능이 켜졌습니다.' : 'AI 프롬프트 기능이 꺼졌습니다.');
                    }}
                    className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 shrink-0",
                        isPromptOn ? "bg-primary text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                    )}
                >
                    <span className="material-symbols-outlined text-sm">{isPromptOn ? 'toggle_on' : 'toggle_off'}</span>
                    {isPromptOn ? 'PROMPT ON' : 'PROMPT OFF'}
                </button>
            </div>

            {isEditMode && (
                <div className="mb-6 flex justify-between items-center p-3 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20 animate-fade-in-up">
                    <p className="text-sm font-black text-primary ml-2">
                        {selectedUrls.length}개 선택됨
                    </p>
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => setSelectedUrls(selectedUrls.length === recommendPosts.length ? [] : recommendPosts.map(p => p.url))}
                            className="px-3 py-1.5 text-[10px] leading-tight font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                            {selectedUrls.length === recommendPosts.length ? <>전체<br/>해제</> : <>전체<br/>선택</>}
                        </button>
                        <button
                            onClick={handleBatchEmail}
                            disabled={selectedUrls.length === 0 || isProcessing}
                            className="px-3 py-1.5 text-[10px] leading-tight font-bold bg-amber-500 text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[56px]"
                        >
                            {isProcessing ? (
                                <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>메일<br/>발송</>
                            )}
                        </button>
                        <button
                            onClick={handleBatchSave}
                            disabled={selectedUrls.length === 0 || isProcessing}
                            className="px-3 py-1.5 text-[10px] leading-tight font-bold bg-primary text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[56px]"
                        >
                            {isProcessing ? (
                                <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>서재<br/>저장</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <SkeletonBlogItem key={i} />
                  ))}
                </div>
            ) : (
                <div className="space-y-3 select-none">
                    {recommendPosts.map((post, idx) => (
                        <RecommendItem
                          key={idx}
                          post={post}
                          addingUrl={addingUrl}
                          isSaved={savedUrls.has(post.url)}
                          isEditMode={isEditMode}
                          isSelected={selectedUrls.includes(post.url)}
                          onAdd={handleAddBlog}
                          onToggleSelect={toggleSelect}
                          onPointerDown={handlePointerDown}
                        />
                    ))}
                </div>
            )
            }
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

export const SkeletonBlogItem = memo(() => (
  <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 overflow-hidden shadow-sm flex items-center pr-3">
      <div className="flex-1 p-4 space-y-3">
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-3/4" />
          <div className="flex justify-between items-center">
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-1/4" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-skeleton w-1/5" />
          </div>
      </div>
      <div className="size-10 shrink-0 bg-slate-100 dark:bg-slate-800 rounded-xl animate-skeleton" />
  </div>
));

const RecommendItem = memo(({ post, addingUrl, isSaved, isEditMode, isSelected, onAdd, onToggleSelect, onPointerDown }: any) => (
  <div
    className={cn(
        "bg-white dark:bg-slate-900/50 rounded-2xl border overflow-hidden shadow-sm flex items-center pr-3 animate-fade-in-up transition-all",
        isEditMode && isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-100 dark:border-primary/10"
    )}
    data-blog-item="true"
    data-url={post.url}
    onPointerDown={(e) => onPointerDown(e, post.url)}
    onContextMenu={(e) => e.preventDefault()}
  >
      <a
        href={isEditMode ? '#' : post.url}
        target={isEditMode ? undefined : "_blank"}
        rel={isEditMode ? undefined : "noopener"}
        onClick={(e) => {
            if (isEditMode) {
                e.preventDefault();
                onToggleSelect(post.url);
            }
        }}
        className="flex-1 p-4 min-w-0"
      >
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
      {isEditMode ? (
          <div className={cn(
              "size-6 rounded-full border-2 flex items-center justify-center transition-all mr-1",
              isSelected ? "bg-primary border-primary" : "border-slate-200 dark:border-slate-700"
          )}>
              {isSelected && <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>}
          </div>
      ) : (
        <button
            onClick={() => { if (!isSaved) onAdd(post); }}
            disabled={addingUrl === post.url || isSaved}
            className={cn(
                "size-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all disabled:opacity-50",
                isSaved
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
            )}
            title={isSaved ? "이미 저장됨" : "내 서재에 추가"}
        >
            {addingUrl === post.url ? (
                <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
                <span className="material-symbols-outlined">{isSaved ? 'task_alt' : 'library_add'}</span>
            )}
        </button>
      )}
  </div>
));
