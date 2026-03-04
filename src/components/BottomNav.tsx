import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  activeTab: 'home' | 'library' | 'stats' | 'profile' | 'add';
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-primary/10 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md px-4 pb-6 pt-2">
      <div className="flex gap-2 max-w-lg mx-auto">
        <Link
          href="/"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'home' || activeTab === 'library' ? "text-primary" : "text-slate-400 dark:text-slate-500 hover:text-primary"
          )}
        >
          <div className="flex h-8 items-center justify-center">
            <span className={cn("material-symbols-outlined", (activeTab === 'home' || activeTab === 'library') && "fill-1")}>auto_stories</span>
          </div>
          <p className="text-xs font-bold leading-normal tracking-wide">서재</p>
        </Link>
        {/* Simplified for now as per design screens */}
        <Link
          href="/add"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'add' ? "text-primary" : "text-slate-400 dark:text-slate-500 hover:text-primary"
          )}
        >
          <div className={cn(
            "flex h-8 items-center justify-center",
            activeTab === 'add' && "bg-primary/20 p-2 rounded-full mb-[-8px]"
          )}>
            <span className={cn("material-symbols-outlined", activeTab === 'add' && "fill-1")}>add_circle</span>
          </div>
          <p className={cn("text-xs leading-normal tracking-wide", activeTab === 'add' ? "font-bold pt-2" : "font-medium")}>추가</p>
        </Link>
        <Link
          href="/stats"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'stats' ? "text-primary" : "text-slate-400 dark:text-slate-500 hover:text-primary"
          )}
        >
          <div className="flex h-8 items-center justify-center">
            <span className={cn("material-symbols-outlined", activeTab === 'stats' && "fill-1")}>calendar_month</span>
          </div>
          <p className="text-xs font-medium leading-normal tracking-wide">캘린더</p>
        </Link>
        <Link
          href="#"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'profile' ? "text-primary" : "text-slate-400 dark:text-slate-500 hover:text-primary"
          )}
        >
          <div className="flex h-8 items-center justify-center">
            <span className={cn("material-symbols-outlined", activeTab === 'profile' && "fill-1")}>person</span>
          </div>
          <p className="text-xs font-medium leading-normal tracking-wide">프로필</p>
        </Link>
      </div>
      <style jsx global>{`
        .fill-1 {
          font-variation-settings: 'FILL' 1;
        }
      `}</style>
    </nav>
  );
}
