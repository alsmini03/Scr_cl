'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { useSession, signOut } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setRecipientEmail(localStorage.getItem('last_blog_email') || 'seokmin.kwon@samsung.com');
  }, []);

  const handleUpdateEmail = (val: string) => {
      setRecipientEmail(val);
      localStorage.setItem('last_blog_email', val);
  };

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="font-display min-h-screen pb-24 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Header title="프로필" />

      <main className="p-6 space-y-8">
        {/* User Info Section */}
        <section className="flex flex-col items-center gap-4 py-6">
          <div className="relative">
            {session?.user?.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="size-24 rounded-full border-4 border-primary/10"
              />
            ) : (
              <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-primary">person</span>
              </div>
            )}
            {session?.user?.isApproved ? (
              <div className="absolute -bottom-1 -right-1 size-8 bg-green-500 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center" title="승인된 사용자">
                <span className="material-symbols-outlined text-white text-xs">verified</span>
              </div>
            ) : (
              <div className="absolute -bottom-1 -right-1 size-8 bg-amber-500 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center" title="승인 대기 중">
                <span className="material-symbols-outlined text-white text-xs">hourglass_empty</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{session?.user?.name || "사용자님"}</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-1">{session?.user?.email || "email@example.com"}</p>
            {session?.user?.isApproved ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                정식 승인됨
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                승인 대기 중
              </span>
            )}
          </div>
        </section>

        {/* Theme Settings Section */}
        {mounted && (
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">화면 테마</h3>
            <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                  theme === 'light' ? "bg-white text-primary shadow-sm" : "text-slate-500"
                )}
              >
                <span className="material-symbols-outlined text-sm">light_mode</span>
                라이트
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                  theme === 'dark' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500"
                )}
              >
                <span className="material-symbols-outlined text-sm">dark_mode</span>
                다크
              </button>
              <button
                onClick={() => setTheme('system')}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                  theme === 'system' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500"
                )}
              >
                <span className="material-symbols-outlined text-sm">settings_brightness</span>
                시스템
              </button>
            </div>
          </section>
        )}

        {/* Email Settings Section */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">메일 수신인 설정</h3>
          <div className="relative">
            <input
                type="email"
                value={recipientEmail}
                onChange={(e) => handleUpdateEmail(e.target.value)}
                placeholder="수신할 이메일 주소"
                className="w-full rounded-2xl border border-slate-200 dark:border-primary/20 bg-white dark:bg-slate-900 p-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-primary shadow-sm pl-11"
            />
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
          </div>
        </section>

        {/* Menu Section */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1 mb-3">설정 및 관리</h3>

          <Link
            href="/profile/queue"
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 bg-amber-100 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined">auto_awesome_motion</span>
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-200">AI 요약 작업 관리</span>
            </div>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>
          </Link>

          <Link
            href="/settings/gemini"
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">settings_suggest</span>
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-200">제미나이 설정</span>
            </div>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>
          </Link>

          <Link
            href="/trash"
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 bg-red-100 dark:bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                <span className="material-symbols-outlined">delete</span>
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-200">휴지통</span>
            </div>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>
          </Link>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-primary/10 active:scale-[0.98] transition-all group mt-4"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400">
                <span className="material-symbols-outlined">logout</span>
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-200">로그아웃</span>
            </div>
          </button>
        </section>
      </main>

      <BottomNav activeTab="profile" />
    </div>
  );
}
