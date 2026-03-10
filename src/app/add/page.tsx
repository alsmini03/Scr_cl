'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { saveBook } from '@/lib/db';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  const handleSave = async () => {
    if (!extractedBook) return;

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
      });

      if (result.success) {
        alert('새 책이 서재에 추가되었습니다.');
        router.push('/');
      } else {
        alert(`저장에 실패했습니다: ${result.error}`);
      }
    } catch (error) {
      console.error('Unexpected error during save:', error);
      alert('저장 중 알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="font-display min-h-screen flex flex-col bg-white">
      <Header title="새 책 추가" showBack />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 pb-32">
        {/* Switch Mode Tab */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
          <button className="flex-1 py-3 px-4 rounded-lg text-sm font-bold bg-white text-primary shadow-sm">
            Yes24
          </button>
          <button
            onClick={() => router.push('/add/youtube')}
            className="flex-1 py-3 px-4 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Youtube
          </button>
        </div>

        {/* Main Action Section */}
        <section className="mb-10">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 ml-1">Yes24 상품 URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 rounded-xl border border-primary/20 bg-white text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 transition-all outline-none"
                  placeholder="https://www.yes24.com/Product/Goods/..."
                />
                <button
                  onClick={handleExtract}
                  disabled={isExtracting}
                  className="bg-primary hover:bg-primary/90 text-white font-bold px-3 rounded-xl transition-colors flex flex-col items-center justify-center gap-0 disabled:opacity-50 min-w-[80px]"
                >
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  <span className="text-[12px] leading-tight">{isExtracting ? '가져오는 중' : '가져오기'}</span>
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-1 ml-1">{error}</p>}
            </div>
          </div>
        </section>

        {/* Preview Placeholder / Loading State */}
        <section className="border-t border-primary/10 pt-6">
          <div className={cn("mt-4 transition-opacity", !extractedBook && "opacity-50 pointer-events-none select-none")}>
            <div className="flex flex-col gap-6">
              <div className="flex gap-4 items-start">
                {/* Book Cover Placeholder or Image - Increased size by 20% from design reference (w-40 h-56 -> w-48 h-64) */}
                <div className="w-48 h-64 bg-slate-50 rounded-lg flex flex-col items-center justify-center shrink-0 border border-slate-200 overflow-hidden shadow-sm">
                  {extractedBook?.coverImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={extractedBook.coverImage} alt={extractedBook.title} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-slate-400 text-3xl mb-1">image</span>
                      <span className="text-[8px] text-slate-400 font-medium">표지 이미지</span>
                    </>
                  )}
                </div>

                {/* Book Details - Top Row */}
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">제목</label>
                    <div className={cn(
                      "min-h-10 bg-slate-50 rounded px-3 py-2 flex items-center text-sm text-slate-900 border border-slate-100 shadow-inner break-words",
                      isExtracting && "animate-pulse"
                    )}>
                      {isExtracting ? "가져오는 중..." : (extractedBook?.title || "도서 제목")}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">저자</label>
                    <div className={cn(
                      "min-h-10 bg-slate-50 rounded px-3 py-2 flex items-center text-sm text-slate-900 border border-slate-100 shadow-inner truncate",
                      isExtracting && "animate-pulse"
                    )}>
                      {isExtracting ? "가져오는 중..." : (extractedBook?.author || "저자명")}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">발행일자</label>
                    <div className={cn(
                      "min-h-10 bg-slate-50 rounded px-3 py-2 flex items-center text-sm text-slate-900 border border-slate-100 shadow-inner truncate",
                      isExtracting && "animate-pulse"
                    )}>
                      {isExtracting ? "가져오는 중..." : (extractedBook?.publishDate || "2024년 01월 01일")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description - Bottom Full Width */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">설명</label>
                <div className={cn(
                  "min-h-24 bg-slate-50 rounded p-3 text-sm text-slate-900 overflow-hidden border border-slate-100 shadow-inner whitespace-pre-wrap",
                  isExtracting && "animate-pulse"
                )}>
                  {isExtracting ? "제미나이가 정보를 분석 중입니다..." : (extractedBook?.description || "도서에 대한 간략한 설명 또는 줄거리가 여기에 추출되어 표시됩니다.")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10">
          <button
            onClick={handleSave}
            disabled={!extractedBook || isSaving}
            className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">save</span>
            {isSaving ? '저장 중...' : '내 서재에 저장하기'}
          </button>
        </div>
      </main>

      <BottomNav activeTab="home" />
    </div>
  );
}
