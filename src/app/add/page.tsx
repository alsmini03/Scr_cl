'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ExtractedBook {
  title: string;
  author: string;
  publishDate: string;
  price: string;
  category: string;
  description: string;
  coverImage?: string;
}

export default function AddBookPage() {
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedBook, setExtractedBook] = useState<ExtractedBook | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
      <Header title="새 책 추가" showBack />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 pb-32">
        {/* Main Action Section */}
        <section className="mb-10">
          <h2 className="text-3xl font-bold leading-tight tracking-tight mb-2">URL로 가져오기</h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg mb-6">
            아래에 Yes24 도서 링크를 붙여넣으세요. <span className="text-primary font-semibold">제미나이</span>가 자동으로 도서 정보를 확인하여 입력해 드립니다.
          </p>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Yes24 상품 URL</label>
              <div className="relative group">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-xl border border-primary/20 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 pr-32 transition-all outline-none"
                  placeholder="https://www.yes24.com/Product/Goods/..."
                />
                <button
                  onClick={handleExtract}
                  disabled={isExtracting}
                  className="absolute right-2 top-2 bottom-2 bg-primary hover:bg-primary/90 text-white font-bold px-4 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <span>{isExtracting ? '가져오는 중...' : '가져오기'}</span>
                  {!isExtracting && <span className="material-symbols-outlined text-sm">auto_awesome</span>}
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-1 ml-1">{error}</p>}
            </div>
          </div>
        </section>

        {/* Preview Placeholder / Loading State */}
        <section className="border-t border-primary/10 pt-10">
          <div className={cn("mt-8 transition-opacity", !extractedBook && "opacity-50 pointer-events-none select-none")}>
            <div className="flex flex-col md:flex-row gap-8">
              {/* Book Cover Placeholder or Image */}
              <div className="w-40 h-56 bg-slate-200 dark:bg-slate-800 rounded-lg flex flex-col items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 overflow-hidden">
                {extractedBook?.coverImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={extractedBook.coverImage} alt={extractedBook.title} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-slate-400 text-4xl mb-2">image</span>
                    <span className="text-[10px] text-slate-400 font-medium">표지 이미지</span>
                  </>
                )}
              </div>

              {/* Book Details */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">제목</label>
                    <div className="min-h-10 bg-slate-200 dark:bg-slate-800 rounded px-3 py-2 flex items-center text-sm text-slate-800 dark:text-slate-200">
                      {extractedBook?.title || "도서 제목이 여기에 표시됩니다"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">저자</label>
                      <div className="min-h-10 bg-slate-200 dark:bg-slate-800 rounded px-3 py-2 flex items-center text-sm text-slate-800 dark:text-slate-200">
                        {extractedBook?.author || "저자명"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">발행일자</label>
                      <div className="min-h-10 bg-slate-200 dark:bg-slate-800 rounded px-3 py-2 flex items-center text-sm text-slate-800 dark:text-slate-200">
                        {extractedBook?.publishDate || "2024년 01월 01일"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">가격</label>
                      <div className="min-h-10 bg-slate-200 dark:bg-slate-800 rounded px-3 py-2 flex items-center text-sm text-slate-800 dark:text-slate-200">
                        {extractedBook?.price || "00,000원"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">도서 분류</label>
                      <div className="min-h-10 bg-slate-200 dark:bg-slate-800 rounded px-3 py-2 flex items-center text-sm text-slate-800 dark:text-slate-200">
                        {extractedBook?.category || "카테고리"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">설명</label>
                    <div className="min-h-24 bg-slate-200 dark:bg-slate-800 rounded p-3 text-sm text-slate-800 dark:text-slate-200 overflow-hidden">
                      {extractedBook?.description || "도서에 대한 간략한 설명 또는 줄거리가 여기에 추출되어 표시됩니다."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10">
          <button
            disabled={!extractedBook}
            className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">save</span>
            내 서재에 저장하기
          </button>
        </div>
      </main>

      <BottomNav activeTab="add" />
    </div>
  );
}
