'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  name: string;
  url: string;
}

interface TabManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: Tab[];
  onReorder: (draggedId: string, hoverId: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onSave: () => Promise<void>;
  title?: string;
}

export default function TabManagementModal({
  isOpen,
  onClose,
  tabs,
  onReorder,
  onDelete,
  onSave,
  title = '탭 관리'
}: TabManagementModalProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const initialTabsRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
        // Record initial state as JSON string for easy comparison
        initialTabsRef.current = JSON.stringify(tabs);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndClose = async () => {
    const currentState = JSON.stringify(tabs);
    if (initialTabsRef.current === currentState) {
        onClose();
        return;
    }

    await onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">edit_square</span>
            {title}
          </h3>
          <button
            onClick={handleSaveAndClose}
            className="size-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">드래그하거나 버튼으로 순서를 변경하세요</p>
          {tabs.map((tab, idx) => (
            <div
              key={tab.id}
              draggable
              onDragStart={() => setDraggedId(tab.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedId) onReorder(draggedId, tab.id);
              }}
              className={cn(
                "flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border transition-all active:scale-[0.98] cursor-move",
                draggedId === tab.id ? "opacity-40 border-primary scale-95" : "border-slate-100 dark:border-slate-700 hover:border-primary/30"
              )}
            >
              <span className="material-symbols-outlined text-slate-400 select-none hidden sm:block">drag_indicator</span>

              <div className="flex flex-col gap-1 mr-1">
                <button
                  onClick={() => idx > 0 && onReorder(tab.id, tabs[idx-1].id)}
                  disabled={idx === 0}
                  className="size-6 flex items-center justify-center rounded bg-slate-200 dark:bg-slate-700 text-slate-500 disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
                </button>
                <button
                  onClick={() => idx < tabs.length - 1 && onReorder(tab.id, tabs[idx+1].id)}
                  disabled={idx === tabs.length - 1}
                  className="size-6 flex items-center justify-center rounded bg-slate-200 dark:bg-slate-700 text-slate-500 disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                </button>
              </div>

              <span className="flex-1 font-bold text-slate-700 dark:text-slate-200 truncate text-sm">{tab.name}</span>

              <button
                onClick={(e) => onDelete(tab.id, e)}
                className="size-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            </div>
          ))}

          {tabs.length === 0 && (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">label_off</span>
              <p className="text-slate-500 text-sm">추가된 탭이 없습니다.</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <button
            onClick={handleSaveAndClose}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            변경사항 저장
          </button>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={handleSaveAndClose} />
    </div>
  );
}
