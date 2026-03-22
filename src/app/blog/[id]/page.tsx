'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getBlogById, deleteBlog, sendBlogEmailAction } from '@/lib/db';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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
      alert('URL이 복사되었습니다.');
    });
  };

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      alert('이메일 주소를 입력해 주세요.');
      return;
    }

    setIsSending(true);
    try {
      const res = await sendBlogEmailAction(blog.id, recipientEmail);
      if (res.success) {
        localStorage.setItem('last_blog_email', recipientEmail);
        alert('이메일이 발송되었습니다.');
        setShowEmailModal(false);
      } else {
        alert(res.error);
      }
    } catch (err) {
      alert('이메일 발송에 실패했습니다.');
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
            onClick={() => setShowEmailModal(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg">mail</span>
            메일 보내기
          </button>
        </div>

        <div className="flex justify-between items-center text-sm">
            {blog.author && <p className="text-primary font-bold">{blog.author}</p>}
            <p className="text-slate-400">{blog.published_at}</p>
        </div>

        {blog.thumbnail && (
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

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">메일 송부 (Gmail)</h3>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">수신인 이메일</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full rounded-xl border dark:border-primary/20 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              onClick={handleSendEmail}
              disabled={isSending || !recipientEmail}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  발송 중...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">send</span>
                  보내기
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
