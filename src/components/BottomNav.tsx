'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';

interface BottomNavProps {
  activeTab: 'home' | 'library' | 'stats' | 'profile' | 'add';
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const { data: session } = useSession();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-primary/10 bg-white/95 backdrop-blur-md px-4 pb-6 pt-2">
      <div className="flex gap-2 max-w-lg mx-auto">
        <Link
          href="/"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'home' || activeTab === 'library' ? "text-primary" : "text-slate-400 hover:text-primary"
          )}
        >
          <div className="flex h-8 items-center justify-center">
            <span className="material-symbols-outlined" style={(activeTab === 'home' || activeTab === 'library') ? { fontVariationSettings: "'FILL' 1" } : {}}>auto_stories</span>
          </div>
          <p className="text-xs font-bold leading-normal tracking-wide">서재</p>
        </Link>

        {session?.user && (
          <Link
            href="/add"
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
              activeTab === 'add' ? "text-primary" : "text-slate-400 hover:text-primary"
            )}
          >
            <div className={cn(
              "flex h-8 items-center justify-center",
              activeTab === 'add' && "bg-primary/20 p-2 rounded-full mb-[-8px]"
            )}>
              <span className="material-symbols-outlined" style={activeTab === 'add' ? { fontVariationSettings: "'FILL' 1" } : {}}>add_circle</span>
            </div>
            <p className={cn("text-xs leading-normal tracking-wide", activeTab === 'add' ? "font-bold pt-2" : "font-medium")}>추가</p>
          </Link>
        )}

        <Link
          href="/stats"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'stats' ? "text-primary" : "text-slate-400 hover:text-primary"
          )}
        >
          <div className="flex h-8 items-center justify-center">
            <span className="material-symbols-outlined" style={activeTab === 'stats' ? { fontVariationSettings: "'FILL' 1" } : {}}>calendar_month</span>
          </div>
          <p className="text-xs font-medium leading-normal tracking-wide">캘린더</p>
        </Link>
        <Link
          href="/profile"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'profile' ? "text-primary" : "text-slate-400 hover:text-primary"
          )}
        >
          <div className="flex h-8 items-center justify-center">
            <span className="material-symbols-outlined" style={activeTab === 'profile' ? { fontVariationSettings: "'FILL' 1" } : {}}>person</span>
          </div>
          <p className="text-xs font-medium leading-normal tracking-wide">프로필</p>
        </Link>
      </div>
    </nav>
  );
}
