'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState } from 'react';
import { cn, isThumbnailInContent } from '@/lib/utils';
import { saveBook, saveBlog, saveYoutubeVideo, getGeminiModels, getGeminiPrompts, addToQueue } from '@/lib/db';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { showToast } from '@/components/Toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import he from 'he';

interface ExtractedBook {
  title: string;
  author: string;
  publishDate: string;
  price: string;
  category: string;
  description: string;
  coverImage?: string;
  yes24Url?: string;
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
  const [contentType, setContentType] = useState<'yes24' | 'youtube' | 'blog' | null>(null);

  const [extractedBook, setExtractedBook] = useState<ExtractedBook | null>(null);
  const [extractedBlog, setExtractedBlog] = useState<{
    title: string;
    author: string;
    url: string;
    thumbnail?: string;
    content: string;
    published_at: string;
  } | null>(null);
  const [extractedYoutube, setExtractedYoutube] = useState<{
    title: string;
    description: string;
    thumbnail: string;
    url: string;
    duration?: string;
    publishDate?: string;
    summary?: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Gemini Settings for YouTube
  const [models, setModels] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState('');

  useEffect(() => {
    async function loadSettings() {
      const [dbModels, dbPrompts] = await Promise.all([getGeminiModels(), getGeminiPrompts()]);
      setModels(dbModels);
      setPrompts(dbPrompts);
      const defModel = dbModels.find(m => m.youtube_default) || dbModels[0];
      if (defModel) setSelectedModel(defModel.name);
      const defPrompt = dbPrompts.find(p => p.youtube_default) || dbPrompts[0];
      if (defPrompt) setSelectedPromptId(defPrompt.id);
    }
    loadSettings();
  }, []);

  useEffect(() => {
    if (url.includes('youtube.com/') || url.includes('youtu.be/')) setContentType('youtube');
    else if (url.includes('yes24.com/')) setContentType('yes24');
    else if (url.includes('blog.naver.com/') || url.includes('tistory.com/')) setContentType('blog');
    else if (url.startsWith('http')) setContentType('blog'); // Default to blog for other links
    else setContentType(null);
  }, [url]);

  const handleExtract = async () => {
    if (!url || !contentType) return;

    setIsExtracting(true);
    setError(null);
    setExtractedBook(null);
    setExtractedBlog(null);
    setExtractedYoutube(null);

    try {
      let endpoint = '';
      let body: any = { url };

      if (contentType === 'yes24') endpoint = '/api/extract';
      else if (contentType === 'blog') endpoint = '/api/blog/extract';
      else if (contentType === 'youtube') {
        endpoint = '/api/youtube/extract';
        const p = prompts.find(p => p.id === selectedPromptId);
        body.model = selectedModel;
        body.prompt = p?.content;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '정보를 가져오는데 실패했습니다.');

      if (contentType === 'yes24') setExtractedBook(data);
      else if (contentType === 'blog') setExtractedBlog(data);
      else if (contentType === 'youtube') setExtractedYoutube({ ...data, url });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '정보를 가져오는 데 실패했습니다.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!contentType) return;
    setIsSaving(true);
    try {
      let result;
      if (contentType === 'yes24' && extractedBook) {
        result = await saveBook({
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
          yes24Url: extractedBook.yes24Url || url,
          toc: extractedBook.toc,
          authorIntro: extractedBook.author_intro,
          inside: extractedBook.inside,
          publisherReview: extractedBook.publisher_review,
        });
      } else if (contentType === 'blog' && extractedBlog) {
        result = await saveBlog({
          title: extractedBlog.title,
          author: extractedBlog.author,
          url: extractedBlog.url,
          thumbnail: extractedBlog.thumbnail,
          content: extractedBlog.content,
          published_at: extractedBlog.published_at
        });
      } else if (contentType === 'youtube' && extractedYoutube) {
        result = await saveYoutubeVideo({
          title: extractedYoutube.title,
          url: extractedYoutube.url,
          thumbnail: extractedYoutube.thumbnail,
          duration: extractedYoutube.duration,
          published_at: extractedYoutube.publishDate,
          summary: '',
          description: extractedYoutube.description,
        });

        if (result?.success && result.id) {
          const p = prompts.find(p => p.id === selectedPromptId);
          await addToQueue('youtube', result.id, {
            url: extractedYoutube.url,
            model: selectedModel,
            prompt: p?.content
          });
        }
      }

      if (result?.success) {
        showToast(contentType === 'youtube' ? '내 서재에 추가되었습니다. 요약은 잠시 후 완료됩니다.' : '내 서재에 추가되었습니다.');
        router.push('/saved');
      } else {
        showToast(result?.error || '저장에 실패했습니다.', 'error');
      }
    } catch (error) {
      showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoAdd = async () => {
    if (!url || !contentType) return;
    setIsAutoAdding(true);
    setError(null);
    try {
      let endpoint = '';
      let body: any = { url };
      if (contentType === 'yes24') endpoint = '/api/extract';
      else if (contentType === 'blog') endpoint = '/api/blog/extract';
      else if (contentType === 'youtube') {
          endpoint = '/api/youtube/extract';
          const p = prompts.find(p => p.id === selectedPromptId);
          body.model = selectedModel;
          body.prompt = p?.content;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '자동 추가 중 오류가 발생했습니다.');

      let saveResult;
      if (contentType === 'yes24') {
          saveResult = await saveBook({
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
              yes24Url: data.yes24Url || url,
              toc: data.toc,
              authorIntro: data.author_intro,
              inside: data.inside,
              publisherReview: data.publisher_review,
          });
      } else if (contentType === 'blog') {
          saveResult = await saveBlog({
              title: data.title,
              author: data.author,
              url: data.url || url,
              thumbnail: data.thumbnail,
              content: data.content,
              published_at: data.published_at
          });
      } else if (contentType === 'youtube') {
          saveResult = await saveYoutubeVideo({
              title: data.title,
              url,
              thumbnail: data.thumbnail,
              duration: data.duration,
              published_at: data.publishDate,
              summary: '',
              description: data.description,
          });

          if (saveResult?.success && saveResult.id) {
            const p = prompts.find(p => p.id === selectedPromptId);
            await addToQueue('youtube', saveResult.id, {
                url,
                model: selectedModel,
                prompt: p?.content
            });
          }
      }

      if (saveResult?.success) {
        showToast(contentType === 'youtube' ? '내 서재에 추가되었습니다. 요약은 잠시 후 완료됩니다.' : '내 서재에 추가되었습니다.');
        router.push('/saved');
      } else {
        showToast(saveResult?.error || '저장 실패', 'error');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '자동 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAutoAdding(false);
    }
  };

  return (
    <div className="font-display min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header title="가져오기" showBack />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 pb-48">
        <section className="mb-10 space-y-4">
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center ml-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">URL 입력</label>
                    {contentType === 'youtube' && (
                        <button
                          onClick={() => router.push('/settings/gemini')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold border border-slate-200 dark:border-primary/10 hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">settings_suggest</span>
                          제미나이 설정
                        </button>
                    )}
                </div>
                <div className="flex flex-col gap-3">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full rounded-xl border border-primary/20 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-14 px-4 transition-all outline-none"
                        placeholder="Youtube, Yes24, 블로그 URL"
                    />

                    {contentType === 'youtube' && (
                        <div className="grid grid-cols-2 gap-3">
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 h-12 px-3 text-xs outline-none appearance-none"
                            >
                                {models.map(model => (
                                    <option key={model.id} value={model.name}>{model.name}</option>
                                ))}
                            </select>
                            <select
                                value={selectedPromptId}
                                onChange={(e) => setSelectedPromptId(e.target.value)}
                                className="rounded-xl border border-primary/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 h-12 px-3 text-xs outline-none appearance-none"
                            >
                                {prompts.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={handleExtract}
                            disabled={isExtracting || isAutoAdding || !contentType}
                            className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-lg">description</span>
                            <span className="text-sm font-bold">
                                {isExtracting ? '분석 중' : '가져오기'}
                            </span>
                        </button>
                        <button
                            onClick={handleAutoAdd}
                            disabled={isExtracting || isAutoAdding || !contentType}
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

        {/* Preview Section */}
        <section className="border-t border-primary/10 pt-6">
          <div className={cn("mt-4 transition-opacity", !extractedBook && !extractedBlog && !extractedYoutube && !isExtracting && !isAutoAdding && "opacity-50 pointer-events-none select-none")}>

            {/* YouTube Preview */}
            {extractedYoutube && (
                <div className="flex flex-col gap-6 animate-fade-in-up">
                  <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-primary/10 shadow-sm relative group">
                    <img src={extractedYoutube.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 text-white text-[9px] font-bold rounded">
                        {extractedYoutube.duration}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold">{extractedYoutube.title}</h2>
                    <p className="text-sm text-slate-500">{extractedYoutube.publishDate}</p>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">AI 요약 분석</label>
                        <div className="w-full rounded-xl border border-slate-200 dark:border-primary/20 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 p-4 prose dark:prose-invert prose-sm max-w-none shadow-inner break-words overflow-x-hidden">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>
                                {he.decode(extractedYoutube.summary || '')}
                            </ReactMarkdown>
                        </div>
                    </div>
                  </div>
                </div>
            )}

            {/* Blog Preview */}
            {extractedBlog && (
                <div className="space-y-6 animate-fade-in-up">
                    <h2 className="text-xl font-bold">{extractedBlog.title}</h2>
                    <div className="flex justify-between items-center text-sm">
                        {extractedBlog.author && <p className="text-primary font-bold">{extractedBlog.author}</p>}
                        <p className="text-slate-400">{extractedBlog.published_at}</p>
                    </div>
                    {extractedBlog.thumbnail && !isThumbnailInContent(extractedBlog.thumbnail, extractedBlog.content) && (
                        <img src={extractedBlog.thumbnail} alt="" className="w-full rounded-2xl" referrerPolicy="no-referrer" />
                    )}
                    <div
                      className="prose dark:prose-invert prose-slate max-w-none"
                      dangerouslySetInnerHTML={{ __html: extractedBlog.content || '' }}
                    />
                </div>
            )}

            {/* Yes24 Preview */}
            {extractedBook && (
                <div className="flex flex-col gap-8 animate-fade-in-up">
                  <div className="flex gap-6 items-start">
                    <div className="w-32 h-48 bg-slate-200 dark:bg-slate-800 rounded-xl flex flex-col items-center justify-center shrink-0 border border-slate-300 dark:border-primary/10 overflow-hidden shadow-lg relative">
                      {extractedBook.coverImage && (
                        <img src={extractedBook.coverImage} alt={extractedBook.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">제목</label>
                        <div className="min-h-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-3 py-2 flex items-center text-sm font-bold border border-slate-100 dark:border-primary/10 shadow-inner break-words">
                            {extractedBook.title}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">저자</label>
                        <div className="h-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-3 flex items-center text-sm border border-slate-100 dark:border-primary/10 shadow-inner truncate">
                            {extractedBook.author}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">발행일자</label>
                        <div className="h-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-3 flex items-center text-sm border border-slate-100 dark:border-primary/10 shadow-inner truncate">
                            {extractedBook.publishDate}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">가격</label>
                            <div className="h-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 flex items-center text-sm border border-slate-100 dark:border-primary/10 shadow-inner truncate">
                                {extractedBook.price}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">도서 분류</label>
                            <div className="h-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 flex items-center text-sm border border-slate-100 dark:border-primary/10 shadow-inner truncate">
                                {extractedBook.category}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">책소개</label>
                        <div className="min-h-32 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-sm border border-slate-100 dark:border-primary/10 shadow-inner whitespace-pre-wrap">
                            {extractedBook.description}
                        </div>
                    </div>
                  </div>
                </div>
            )}

            {isExtracting && (
                <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400 animate-pulse">
                    <span className="material-symbols-outlined text-5xl animate-spin text-primary">sync</span>
                    <p className="font-bold">정보를 가져오는 중입니다...</p>
                </div>
            )}
          </div>
        </section>
      </main>

      <BottomNav activeTab="library" />

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-[86px] left-0 right-0 p-4 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-t border-slate-100 dark:border-primary/10 z-20">
        <div className="max-w-2xl mx-auto flex justify-center">
          <button
            onClick={handleSave}
            disabled={(!extractedBook && !extractedBlog && !extractedYoutube) || isSaving}
            className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xl">save</span>
            {isSaving ? '저장 중...' : '저장하기'}
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
