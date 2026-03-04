'use client';

import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="font-display min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-12">
        <div className="size-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-5xl text-primary">menu_book</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Book Journal</h1>
        <p className="text-slate-500">나만의 독서 기록장을 시작해 보세요</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
        >
          {/* Simple Google Icon SVG */}
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
          </svg>
          Google로 시작하기
        </button>
      </div>

      <div className="mt-12 text-slate-400 text-xs">
        <p>© 2026 Book Journal. All rights reserved.</p>
      </div>
    </div>
  );
}
