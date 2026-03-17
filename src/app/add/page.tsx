'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { saveBook, saveBlog } from '@/lib/db';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface ExtractedBook {
  title: string;
  author: string;
  publishDate: string;
  price: string;
  category: string;
  description: string;
  coverImage?: string;
  intro?: string;
  toc?: string;
  author_intro?: string;
  inside?: string;
  publisher_review?: string;
}

function AddContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoAdding, setIsAutoAdding] = useState(false);
  const [extractedBook, setExtractedBook] = useState<ExtractedBook | null>(null);
  const [extractedBlog, setExtractedBlog] = useState<{
    title: string;
    author: string;
    url: string;
    thumbnail?: string;
    content: string;
    published_at: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'yes24' | 'youtube' | 'blog'>('yes24');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'blog') setActiveTab('blog');
    else if (tab === 'yes24') setActiveTab('yes24');
    else if (tab === 'youtube') router.push('/add/youtube');
  }, [searchParams, router]);

  const handleExtract = async () => {
    if (!url) return;

    setIsExtracting(true);
    setError(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract book info');
      }

      const data = await response.json();
      setExtractedBook(data);
    } catch (err: unknown) {
      console.error('Extraction error:', err);
      const message = err instanceof Error ? err.message : '정보를 가져오는 데 실패했습니다.';
      setError(message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async (showSuccessAlert = true) => {
    if (!extractedBook) return { success: false, error: 'No data to save' };

    setIsSaving(true);
    try {
      const result = await saveBook({
        title: extractedBook.title,
        author: extractedBook.author,
        coverImage: extractedBook.coverImage || 'https://image.yes24.com/momo/Noimg_L.jpg',
        category: extractedBook.category,
        publishDate: extractedBook.publishDate,
        price: extractedBook.price,
        description: extractedBook.description,
        readingStatus: 'READING',
        progress: 0,
        intro: extractedBook.intro,
        toc: extractedBook.toc,
        authorIntro: extractedBook.author_intro,
        inside: extractedBook.inside,
        publisherReview: extractedBook.publisher_review,
      });

      if (result.success) {
        if (showSuccessAlert) alert('새 책이 서재에 추가되었습니다.');
        router.push('/');
        return { success: true };
      } else {
        if (showSuccessAlert) alert(`저장에 실패했습니다: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Unexpected error during save:', error);
      if (showSuccessAlert) alert('저장 중 알 수 없는 오류가 발생했습니다.');
      return { success: false, error: 'Unknown error' };
    } finally {
      setIsSaving(false);
    }
  };

  const handleExtractBlog = async () => {
    if (!url) return;
    setIsExtracting(true);
    setError(null);
    try {
      const res = await fetch('/api/blog/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExtractedBlog(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '블로그 정보를 가져오는 데 실패했습니다.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveBlog = async () => {
      if (!extractedBlog) return;
      setIsSaving(true);
      const res = await saveBlog({
          title: extractedBlog.title,
          author: extractedBlog.author,
          url: extractedBlog.url,
          thumbnail: extractedBlog.thumbnail,
          content: extractedBlog.content,
          published_at: extractedBlog.published_at
      });
      if (res.success) {
          alert('블로그 글이 저장되었습니다.');
          router.push('/blog');
      } else {
          alert(res.error);
      }
      setIsSaving(false);
  };

  const handleAutoAdd = async () => {
    if (!url) return;

    setIsAutoAdding(true);
    setError(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to extract book info');

      setExtractedBook(data);

      const saveResult = await saveBook({
        title: data.title,
        author: data.author,
        coverImage: data.coverImage || 'https://image.yes24.com/momo/Noimg_L.jpg',
        category: data.category,
        publishDate: data.publishDate,
        price: data.price,
        description: data.description,
        readingStatus: 'READING',
        progress: 0,
        intro: data.intro,
        toc: data.toc,
        authorIntro: data.author_intro,
        inside: data.inside,
        publisherReview: data.publisher_review,
      });

      if (saveResult.success) {
        alert('자동 추가되었습니다.');
        router.push('/');
      } else {
        alert(`자동 저장 실패: ${saveResult.error}`);
      }
    } catch (err: unknown) {
      console.error('Auto Add error:', err);
      setError(err instanceof Error ? err.message : '자동 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAutoAdding(false);
    }
  };

  return (
    <div className="font-display min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header title="가져오기" showBack />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 pb-48">
        {/* Switch Mode Tab */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('yes24')}
            className={cn("flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all", activeTab === 'yes24' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400")}
          >
            Yes24
          </button>
          <button
            onClick={() => router.push('/add/youtube')}
            className="flex-1 py-3 px-4 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            Youtube
          </button>
          <button
            onClick={() => setActiveTab('blog')}
            className={cn("flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all", activeTab === 'blog' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400")}
          >
            블로그
          </button>
        </div>

        {activeTab === 'yes24' ? (
        <>
            <section className="mb-10 space-y-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Yes24 상품 URL</label>
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full rounded-xl border border-primary/20 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-14 px-4 transition-all outline-none"
                            placeholder="https://www.yes24.com/Product/Goods/..."
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleExtract}
                                disabled={isExtracting || isAutoAdding}
                                className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-lg">description</span>
                                <span className="text-sm font-bold">
                                    {isExtracting ? '가져오는 중' : '가져오기'}
                                </span>
                            </button>
                            <button
                                onClick={handleAutoAdd}
                                disabled={isExtracting || isAutoAdding}
                                className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                                <span className="text-sm font-bold">
                                    {isAutoAdding ? '추가 중' : '자동 추가'}
                                </span>
                            </button>
                        </div>
                    </div>
                    {error && <p className="text-red-500 text-sm mt-1 ml-1">{error}</p>}
                </div>
            </section>

            {/* Preview State */}
            <section className="border-t border-primary/10 pt-6">
              <div className={cn("mt-4 transition-opacity", !extractedBook && !isExtracting && !isAutoAdding && "opacity-50 pointer-events-none select-none")}>
                <div className="flex flex-col gap-8">
                  {/* Cover and Primary Metadata Row */}
                  <div className="flex gap-6 items-start">
                    {/* Book Cover - Left */}
                    <div className="w-32 h-48 bg-slate-200 dark:bg-slate-800 rounded-xl flex flex-col items-center justify-center shrink-0 border border-slate-300 dark:border-primary/10 overflow-hidden shadow-lg relative">
                      {extractedBook?.coverImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={extractedBook.coverImage} alt={extractedBook.title} className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-slate-400 text-4xl mb-1">image</span>
                          <span className="text-[10px] text-slate-400 font-medium">표지 이미지</span>
                        </>
                      )}
                      {(isExtracting || isAutoAdding) && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 animate-pulse flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>}
                    </div>

                    {/* Metadata - Right */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">제목</label>
                        <div className={cn(
                            "min-h-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-3 py-2 flex items-center text-sm font-bold text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-primary/10 shadow-inner break-words",
                            (isExtracting || isAutoAdding) && "animate-pulse"
                        )}>
                            {(isExtracting || isAutoAdding) ? "가져오는 중..." : (extractedBook?.title || "도서 제목")}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">저자</label>
                        <div className={cn(
                            "h-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-3 flex items-center text-sm text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-primary/10 shadow-inner truncate",
                            (isExtracting || isAutoAdding) && "animate-pulse"
                        )}>
                            {(isExtracting || isAutoAdding) ? "" : (extractedBook?.author || "")}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">발행일자</label>
                        <div className={cn(
                            "h-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-3 flex items-center text-sm text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-primary/10 shadow-inner truncate",
                            (isExtracting || isAutoAdding) && "animate-pulse"
                        )}>
                            {(isExtracting || isAutoAdding) ? "" : (extractedBook?.publishDate || "")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Metadata */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">가격</label>
                            <div className={cn(
                                "h-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 flex items-center text-sm text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-primary/10 shadow-inner truncate",
                                (isExtracting || isAutoAdding) && "animate-pulse"
                            )}>
                                {(isExtracting || isAutoAdding) ? "" : (extractedBook?.price || "")}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">도서 분류</label>
                            <div className={cn(
                                "h-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 flex items-center text-sm text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-primary/10 shadow-inner truncate",
                                (isExtracting || isAutoAdding) && "animate-pulse"
                            )}>
                                {(isExtracting || isAutoAdding) ? "" : (extractedBook?.category || "")}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">책소개</label>
                        <div className={cn(
                            "min-h-32 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-primary/10 shadow-inner whitespace-pre-wrap",
                            (isExtracting || isAutoAdding) && "animate-pulse"
                        )}>
                            {(isExtracting || isAutoAdding) ? "내용을 가져오는 중입니다..." : (extractedBook?.description || "도서 정보가 표시됩니다.")}
                        </div>
                    </div>
                  </div>

                  {/* Detailed Sections */}
                  <div className="space-y-6">
                    {extractedBook?.toc && (
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">목차</label>
                            <div className="w-full rounded-xl border border-slate-100 dark:border-primary/10 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 p-4 text-sm shadow-inner whitespace-pre-wrap max-h-64 overflow-y-auto no-scrollbar">
                                {extractedBook.toc}
                            </div>
                        </div>
                    )}
                    {extractedBook?.author_intro && (
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">저자 소개</label>
                            <div className="w-full rounded-xl border border-slate-100 dark:border-primary/10 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 p-4 text-sm shadow-inner whitespace-pre-wrap">
                                {extractedBook.author_intro}
                            </div>
                        </div>
                    )}
                    {extractedBook?.publisher_review && (
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">출판사 리뷰</label>
                            <div className="w-full rounded-xl border border-slate-100 dark:border-primary/10 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 p-4 text-sm shadow-inner whitespace-pre-wrap">
                                {extractedBook.publisher_review}
                            </div>
                        </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
        </>
        ) : (
            <>
            <section className="mb-10 space-y-4">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full rounded-xl border border-primary/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 transition-all outline-none"
                            placeholder="https://blog.naver.com/..."
                        />
                        <button
                            onClick={handleExtractBlog}
                            disabled={isExtracting}
                            className="w-full bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-lg">description</span>
                            <span className="text-sm font-bold">
                                {isExtracting ? '가져오는 중' : '정보 가져오기'}
                            </span>
                        </button>
                    </div>
                    {error && <p className="text-red-500 text-sm mt-1 ml-1">{error}</p>}
                </div>
            </section>
            <section className="border-t border-primary/10 pt-6">
                <div className={cn("mt-4 transition-opacity", !extractedBlog && !isExtracting && "opacity-50 pointer-events-none select-none")}>
                    {extractedBlog && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold">{extractedBlog.title}</h2>
                            {extractedBlog.author && <p className="text-sm text-primary font-bold">{extractedBlog.author}</p>}
                            {extractedBlog.thumbnail && <img src={extractedBlog.thumbnail} alt="" className="w-full rounded-2xl" referrerPolicy="no-referrer" />}
                            <div className="prose dark:prose-invert prose-slate max-w-none">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw]}
                                    components={{
                                        img: ({ node, ...props }) => <img {...props} referrerPolicy="no-referrer" className="w-full rounded-2xl" />
                                    }}
                                >
                                    {extractedBlog.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}
                    {isExtracting && <div className="py-20 text-center animate-pulse">정보를 가져오는 중입니다...</div>}
                </div>
            </section>
            </>
        )}
      </main>

      <BottomNav activeTab="library" />

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-[88px] left-0 right-0 p-4 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-t border-slate-100 dark:border-primary/10 z-20">
        <div className="max-w-2xl mx-auto flex justify-center">
          <button
            onClick={() => activeTab === 'yes24' ? handleSave() : handleSaveBlog()}
            disabled={(!extractedBook && !extractedBlog) || isSaving}
            className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xl">save</span>
            {isSaving ? '저장 중...' : '내 서재에 저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AddBookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center"><div className="animate-spin text-primary"><span className="material-symbols-outlined text-4xl">sync</span></div></div>}>
      <AddContent />
    </Suspense>
  );
}
