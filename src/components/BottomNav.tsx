'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface BottomNavProps {
  activeTab: string;
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const router = useRouter();

  const handleTabClick = (e: React.MouseEvent, tab: string) => {
    if (activeTab === tab) {
      e.preventDefault();
      router.refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-primary/10 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 pb-6 pt-2">
      <div className="flex gap-2 max-w-lg mx-auto">
        {/* Yes24 */}
        <Link
          href="/best"
          onClick={(e) => handleTabClick(e, 'yes24')}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'yes24' ? "text-primary" : "text-slate-400 dark:text-slate-500"
          )}
        >
          <div className="flex h-8 items-center justify-center">
            <span className={cn("material-symbols-outlined", activeTab === 'yes24' && "fill-1")}>library_books</span>
          </div>
          <p className={cn("text-xs leading-normal tracking-wide", activeTab === 'yes24' ? "font-bold" : "font-medium")}>Yes24</p>
        </Link>

        {/* Youtube */}
        <Link
          href="/youtube/recommend"
          onClick={(e) => handleTabClick(e, 'youtube')}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'youtube' ? "text-primary" : "text-slate-400 dark:text-slate-500"
          )}
        >
          <div className="flex h-8 items-center justify-center">
            <span className={cn("material-symbols-outlined", activeTab === 'youtube' && "fill-1")}>video_library</span>
          </div>
          <p className={cn("text-xs leading-normal tracking-wide", activeTab === 'youtube' ? "font-bold" : "font-medium")}>Youtube</p>
        </Link>

        {/* Blog */}
        <Link
          href="/blog"
          onClick={(e) => handleTabClick(e, 'blog')}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'blog' ? "text-primary" : "text-slate-400 dark:text-slate-500"
          )}
        >
          <div className="flex h-8 items-center justify-center">
            <span className={cn("material-symbols-outlined", activeTab === 'blog' && "fill-1")}>rss_feed</span>
          </div>
          <p className={cn("text-xs leading-normal tracking-wide", activeTab === 'blog' ? "font-bold" : "font-medium")}>블로그</p>
        </Link>


        {/* Profile */}
        <Link
          href="/profile"
          onClick={(e) => handleTabClick(e, 'profile')}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            activeTab === 'profile' ? "text-primary" : "text-slate-400 dark:text-slate-500"
          )}
        >
          <div className="flex h-8 items-center justify-center">
            <span className={cn("material-symbols-outlined", activeTab === 'profile' && "fill-1")}>person</span>
          </div>
          <p className={cn("text-xs leading-normal tracking-wide", activeTab === 'profile' ? "font-bold" : "font-medium")}>프로필</p>
        </Link>
      </div>
    </nav>
  );
}
