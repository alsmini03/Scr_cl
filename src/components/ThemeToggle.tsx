'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="size-10" />;
  }

  const themes = [
    { name: 'system', label: '시스템', icon: 'settings_brightness' },
    { name: 'light', label: '밝게', icon: 'light_mode' },
    { name: 'dark', label: '어둡게', icon: 'dark_mode' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex size-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors text-slate-900 dark:text-slate-100"
        aria-label="Toggle theme"
      >
        <span className="material-symbols-outlined">
          {theme === 'dark' ? 'dark_mode' : theme === 'light' ? 'light_mode' : 'settings_brightness'}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-primary/10 z-50 overflow-hidden py-1">
            {themes.map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  setTheme(t.name);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-4 py-2.5 flex items-center gap-3 text-sm transition-colors",
                  theme === t.name
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <span className="material-symbols-outlined text-lg">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
