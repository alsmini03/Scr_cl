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
      "sticky top-0 z-40 flex items-center p-4 justify-between border-b border-primary/10",
      transparent ? "bg-white/80 backdrop-blur-md" : "bg-white"
    )}>
      <div className="flex size-10 shrink-0 items-center justify-center">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="text-slate-900 flex size-10 items-center justify-center hover:bg-primary/10 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="material-symbols-outlined">menu</span>
          </div>
        )}
      </div>

      <h1 className="text-xl font-bold leading-tight tracking-tight flex-1 text-center truncate px-2 text-slate-900">
        {title}
      </h1>

      <div className="flex items-center justify-end gap-1">
        <div className="flex size-10 items-center justify-center">
          {rightAction}
        </div>
      </div>
    </header>
  );
}
