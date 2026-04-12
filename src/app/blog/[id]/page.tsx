'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getBlogById, deleteBlog, sendBlogEmailAction } from '@/lib/db';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn, formatDateToYMD, isThumbnailInContent } from '@/lib/utils';
import { showToast } from '@/components/Toast';

export default function BlogDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [blog, setBlog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('seokmin.kwon@samsung.com');

  useEffect(() => {
    const lastEmail = localStorage.getItem('last_blog_email');
    if (lastEmail) setRecipientEmail(lastEmail);
  }, []);

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

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(blog.url).then(() => {
        showToast('URL이 복사되었습니다.');
    });
  };

  const handleSendEmail = async () => {
    const email = localStorage.getItem('last_blog_email') || 'seokmin.kwon@samsung.com';
    setIsSending(true);
    try {
      const res = await sendBlogEmailAction(blog.id, email);
      if (res.success) {
        showToast('메일이 발송되었습니다.');
      } else {
        showToast(res.error || '발송 실패', 'error');
      }
    } catch (err) {
      showToast('이메일 발송에 실패했습니다.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="font-display min-h-screen pb-24 bg-white dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="블로그 글"
        showBack
        rightAction={
            <button onClick={handleDelete} className="text-red-500 p-2" title="삭제"><span className="material-symbols-outlined">delete</span></button>
        }
      />

      <main className="p-4 space-y-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight">{blog.title}</h1>

        {/* Action Bar */}
        <div className="flex items-center gap-2 py-2 border-y border-slate-100 dark:border-primary/10">
          <a
            href={blog.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-bold active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg">open_in_new</span>
            원문 보기
          </a>
          <button
            onClick={handleCopyUrl}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg">content_copy</span>
            URL 복사
          </button>
          <button
            onClick={handleSendEmail}
            disabled={isSending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-50"
          >
            {isSending ? (
                <div className="size-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
                <>
                <span className="material-symbols-outlined text-lg">mail</span>
                메일 보내기
                </>
            )}
          </button>
        </div>

        <div className="flex justify-between items-center text-sm">
            {blog.author && <p className="text-primary font-bold">{blog.author}</p>}
            <p className="text-slate-400">
                {formatDateToYMD(blog.published_at)}
            </p>
        </div>

        {blog.thumbnail && !isThumbnailInContent(blog.thumbnail, blog.content) && (
            <div className="w-full rounded-2xl overflow-hidden border border-slate-100 dark:border-primary/10">
                <img src={blog.thumbnail} alt="" className="w-full" referrerPolicy="no-referrer" />
            </div>
        )}

        <div
          className="prose dark:prose-invert prose-slate max-w-none pb-20"
          dangerouslySetInnerHTML={{ __html: blog.content || '' }}
        />
      </main>

      <BottomNav activeTab="blog" />
    </div>
  );
}
