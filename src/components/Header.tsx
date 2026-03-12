'use client';

import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  transparent?: boolean;
}

export default function Header({ title, showBack, rightAction, transparent }: HeaderProps) {
  const router = useRouter();

  return (
    <header className={cn(
      "sticky top-0 z-40 flex items-center p-4 justify-between border-b border-primary/10 transition-colors",
      transparent
        ? "bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md"
        : "bg-background-light dark:bg-background-dark"
    )}>
      <div className="flex size-10 shrink-0 items-center justify-center">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="text-slate-900 dark:text-slate-100 flex size-10 items-center justify-center hover:bg-primary/10 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="material-symbols-outlined">menu</span>
          </div>
        )}
      </div>

      <h1 className="text-xl font-bold leading-tight tracking-tight flex-1 text-center truncate px-2 text-slate-900 dark:text-slate-100">
        {title}
      </h1>

      <div className="flex items-center justify-end min-w-10">
        {rightAction || (
          <button className="flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-2xl">search</span>
          </button>
        )}
      </div>
    </header>
  );
}
