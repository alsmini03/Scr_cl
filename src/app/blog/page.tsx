'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useEffect, useState } from 'react';
import { saveBlog, getBlogs, deleteBlog } from '@/lib/db';
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

  const loadMyBlogs = async () => {
    const data = await getBlogs();
    setBlogs(data);
  };

  const fetchRecommend = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/blog/list?blogId=totcar');
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
    fetchRecommend();
  }, []);

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

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="블로그"
        rightAction={
            <button
                onClick={() => window.location.href = '/add?tab=blog'}
                className="text-primary p-2"
            >
                <span className="material-symbols-outlined text-2xl">add_circle</span>
            </button>
        }
      />

      <main className="mt-4 px-4">
        {/* Toggle View Mode */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-200 dark:bg-slate-800 rounded-xl max-w-xs mx-auto">
            <button
              onClick={() => setViewMode('recommend')}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-bold transition-all text-center",
                viewMode === 'recommend' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
            >
              추천
            </button>
            <button
              onClick={() => setViewMode('my')}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-bold transition-all text-center",
                viewMode === 'my' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
            >
              내 보관함
            </button>
        </div>

        {viewMode === 'recommend' ? (
            isLoading ? (
                <div className="flex justify-center py-20"><div className="animate-spin text-primary"><span className="material-symbols-outlined text-4xl">sync</span></div></div>
            ) : (
                <div className="space-y-4">
                    {recommendPosts.map((post, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 overflow-hidden shadow-sm flex">
                            <a href={post.url} target="_blank" rel="noopener" className="flex-1 flex gap-4 p-3">
                                <div className="size-20 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                                    {post.thumbnail && <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight mb-1">{post.title}</h3>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{post.published_at}</p>
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
        ) : (
            blogs.length === 0 ? (
                <div className="py-20 text-center text-slate-400">저장된 글이 없습니다.</div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {blogs.map((blog) => (
                        <Link key={blog.id} href={`/blog/${blog.id}`} className="flex flex-col bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 overflow-hidden shadow-sm active:scale-[0.98] transition-all relative group">
                            <div className="aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                {blog.thumbnail && <img src={blog.thumbnail} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="p-3">
                                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-2 leading-tight">{blog.title}</h3>
                            </div>
                            <button
                                onClick={(e) => handleDelete(blog.id, e)}
                                className="absolute top-2 right-2 size-7 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
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
