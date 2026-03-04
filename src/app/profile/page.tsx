'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

export default function ProfilePage() {
  return (
    <div className="font-display min-h-screen pb-24 bg-white">
      <Header title="프로필" />

      <main className="p-6 space-y-8">
        {/* User Info Section */}
        <section className="flex flex-col items-center gap-4 py-6">
          <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-primary">person</span>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">사용자님</h2>
            <p className="text-slate-500">book-journal@example.com</p>
          </div>
        </section>

        {/* Menu Section */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-3">설정 및 관리</h3>

          <Link
            href="/trash"
            className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 bg-red-100 rounded-xl flex items-center justify-center text-red-500">
                <span className="material-symbols-outlined">delete</span>
              </div>
              <span className="font-bold text-slate-700">휴지통</span>
            </div>
            <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
          </Link>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 opacity-50">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-500">
                <span className="material-symbols-outlined">settings</span>
              </div>
              <span className="font-bold text-slate-700">앱 설정</span>
            </div>
            <span className="material-symbols-outlined text-slate-300">chevron_right</span>
          </div>
        </section>
      </main>

      <BottomNav activeTab="profile" />
    </div>
  );
}
