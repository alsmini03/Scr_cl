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
}

export default function AddBookPage() {
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedBook, setExtractedBook] = useState<ExtractedBook | null>(null);

  const handleExtract = () => {
    if (!url) return;

    setIsExtracting(true);
    // Mocking Gemini extraction
    setTimeout(() => {
      setExtractedBook({
        title: '위대한 개츠비',
        author: 'F. Scott Fitzgerald',
        publishDate: '1925년 4월 10일',
        price: '15,000원',
        category: '소설 / 고전',
        description: '1920년대 미국을 배경으로 무너져가는 아메리칸 드림을 날카롭게 포착한 F. 스콧 피츠제럴드의 걸작입니다.'
      });
      setIsExtracting(false);
    }, 1500);
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
      <Header title="새 책 추가" showBack />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6">
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
            </div>
          </div>
        </section>

        {/* Preview Placeholder / Loading State */}
        <section className="border-t border-primary/10 pt-10">
          <div className={cn("mt-8 transition-opacity", !extractedBook && "opacity-50 pointer-events-none select-none")}>
            <div className="flex flex-col md:flex-row gap-8">
              {/* Book Cover Placeholder */}
              <div className="w-40 h-56 bg-slate-200 dark:bg-slate-800 rounded-lg flex flex-col items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700">
                <span className="material-symbols-outlined text-slate-400 text-4xl mb-2">image</span>
                <span className="text-[10px] text-slate-400 font-medium">표지 이미지</span>
              </div>

              {/* Book Details */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">제목</label>
                    <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded px-3 flex items-center text-sm text-slate-400">
                      {extractedBook?.title || "도서 제목이 여기에 표시됩니다"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">저자</label>
                      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded px-3 flex items-center text-sm text-slate-400">
                        {extractedBook?.author || "저자명"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">발행일자</label>
                      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded px-3 flex items-center text-sm text-slate-400">
                        {extractedBook?.publishDate || "2024년 01월 01일"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">가격</label>
                      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded px-3 flex items-center text-sm text-slate-400">
                        {extractedBook?.price || "00,000원"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">도서 분류</label>
                      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded px-3 flex items-center text-sm text-slate-400">
                        {extractedBook?.category || "카테고리"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">설명</label>
                    <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded p-3 text-sm text-slate-400 overflow-hidden">
                      {extractedBook?.description || "도서에 대한 간략한 설명 또는 줄거리가 여기에 추출되어 표시됩니다."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10 mb-4">
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
