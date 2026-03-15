'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getBlogById, deleteBlog } from '@/lib/db';
import { notFound, useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { useEffect, useState } from 'react';

export default function BlogDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [blog, setBlog] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const data = await getBlogById(id);
      if (data) setBlog(data);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary">sync</span></div>;
  if (!blog) notFound();

  const handleDelete = async () => {
      if (!confirm('삭제하시겠습니까?')) return;
      const res = await deleteBlog(blog.id);
      if (res.success) {
          router.push('/blog');
      }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-white dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="블로그 글"
        showBack
        rightAction={
            <button onClick={handleDelete} className="text-red-500 p-2"><span className="material-symbols-outlined">delete</span></button>
        }
      />

      <main className="p-4 space-y-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight">{blog.title}</h1>
        <p className="text-sm text-slate-400">{blog.published_at}</p>

        {blog.thumbnail && (
            <div className="w-full rounded-2xl overflow-hidden border border-slate-100 dark:border-primary/10">
                <img src={blog.thumbnail} alt="" className="w-full" referrerPolicy="no-referrer" />
            </div>
        )}

        <div className="prose dark:prose-invert prose-slate max-w-none pb-20">
            <ReactMarkdown
                components={{
                    img: ({ node, ...props }) => <img {...props} referrerPolicy="no-referrer" className="w-full rounded-2xl" />
                }}
            >
                {blog.content}
            </ReactMarkdown>
        </div>
      </main>

      <BottomNav activeTab="blog" />
    </div>
  );
}
