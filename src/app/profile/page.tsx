'use client';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import { useSession, signOut } from "next-auth/react";
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="font-display min-h-screen pb-24 bg-white">
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
              <div className="absolute -bottom-1 -right-1 size-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center" title="승인된 사용자">
                <span className="material-symbols-outlined text-white text-xs">verified</span>
              </div>
            ) : (
              <div className="absolute -bottom-1 -right-1 size-8 bg-amber-500 rounded-full border-4 border-white flex items-center justify-center" title="승인 대기 중">
                <span className="material-symbols-outlined text-white text-xs">hourglass_empty</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">{session?.user?.name || "사용자님"}</h2>
            <p className="text-slate-500 mb-1">{session?.user?.email || "email@example.com"}</p>
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

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 active:scale-[0.98] transition-all group mt-4"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined">logout</span>
              </div>
              <span className="font-bold text-slate-700">로그아웃</span>
            </div>
          </button>
        </section>
      </main>

      <BottomNav activeTab="profile" />
    </div>
  );
}
