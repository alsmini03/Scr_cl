'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Book } from '@/types/book';
import { getBooks } from '@/lib/db';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function CalendarPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBooks() {
      try {
        const data = await getBooks();
        setBooks(data);
      } catch (error) {
        console.error('Failed to fetch books:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchBooks();
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getBooksForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return books.filter(book => book.createdAt?.startsWith(dateStr));
  };

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    calendarDays.push(i);
  }

  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header
        title="캘린더"
        rightAction={
          <button
            onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
            className="flex items-center justify-center text-primary"
          >
            <span className="material-symbols-outlined text-2xl">
              {viewMode === 'calendar' ? 'list' : 'calendar_month'}
            </span>
          </button>
        }
      />

      <main className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : viewMode === 'calendar' ? (
          <section className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-primary/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{year}년 {monthNames[month]}</h2>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 hover:bg-primary/10 rounded-full transition-colors text-slate-900 dark:text-slate-100">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button onClick={nextMonth} className="p-2 hover:bg-primary/10 rounded-full transition-colors text-slate-900 dark:text-slate-100">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />;

                const dayBooks = getBooksForDate(day);
                const hasBooks = dayBooks.length > 0;

                return (
                  <div
                    key={day}
                    className={cn(
                      "aspect-square flex flex-col items-center justify-center rounded-xl text-sm relative transition-colors",
                      hasBooks ? "bg-primary text-white font-bold shadow-md shadow-primary/20" : "hover:bg-primary/5 text-slate-900 dark:text-slate-100"
                    )}
                  >
                    {day}
                    {hasBooks && (
                      <div className="absolute bottom-1 flex gap-0.5">
                        {dayBooks.slice(0, 3).map((_, i) => (
                          <div key={i} className="size-1 bg-white rounded-full" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <h3 className="text-xl font-bold px-1 text-slate-900 dark:text-slate-100">기록 리스트</h3>
            <div className="space-y-3">
              {books.length > 0 ? (
                books.sort((a, b) => {
                  const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return dateB - dateA;
                }).map(book => (
                  <Link href={`/book/${book.id}`} key={book.id} className="flex gap-4 p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-primary/10 active:scale-[0.98] transition-transform shadow-sm">
                    <div
                      className="w-16 h-24 bg-center bg-no-repeat bg-cover rounded-lg shrink-0 shadow-sm"
                      style={{ backgroundImage: `url("${book.coverImage}")` }}
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="font-bold truncate text-lg text-slate-900 dark:text-slate-100">{book.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{book.author}</p>
                      {book.createdAt && (
                        <p className="text-xs text-primary mt-2 font-semibold">
                          {new Date(book.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short'
                          })} 추가됨
                        </p>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-20 text-center text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-20">library_books</span>
                  <p>기록된 도서가 없습니다.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {!loading && viewMode === 'calendar' && (
          <section className="mt-8 space-y-4">
            <h3 className="text-lg font-bold px-1 text-slate-900 dark:text-slate-100">최근 추가된 도서</h3>
            <div className="space-y-3">
              {books.length > 0 ? (
                books.slice(0, 5).map(book => (
                  <div key={book.id} className="flex gap-4 p-3 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-primary/10 shadow-sm">
                    <div
                      className="w-12 h-16 bg-center bg-no-repeat bg-cover rounded-lg shrink-0 shadow-sm"
                      style={{ backgroundImage: `url("${book.coverImage}")` }}
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="font-bold truncate text-sm text-slate-900 dark:text-slate-100">{book.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{book.author}</p>
                      {book.createdAt && (
                        <p className="text-[10px] text-primary mt-1 font-medium">
                          {new Date(book.createdAt).toLocaleDateString('ko-KR')} 추가됨
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 px-1">최근 추가된 도서가 없습니다.</p>
              )}
            </div>
          </section>
        )}
      </main>

      <BottomNav activeTab="calendar" />
    </div>
  );
}
