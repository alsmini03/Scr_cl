'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

let toastCount = 0;
let addToastFn: (message: string, type?: 'success' | 'error' | 'info') => void;

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    if (addToastFn) {
        addToastFn(message, type);
    }
}

export default function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = ++toastCount;
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    useEffect(() => {
        addToastFn = addToast;
    }, [addToast]);

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-3 w-full max-w-xs pointer-events-none">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={cn(
                        "px-6 py-3 rounded-2xl shadow-xl text-white font-bold text-sm animate-fade-in-down pointer-events-auto backdrop-blur-md break-words",
                        toast.type === 'success' ? "bg-primary/90" :
                        toast.type === 'error' ? "bg-red-500/90" : "bg-slate-700/90"
                    )}
                >
                    <div className="flex items-start gap-2">
                        {toast.type === 'success' && <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">check_circle</span>}
                        {toast.type === 'error' && <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">error</span>}
                        {toast.type === 'info' && <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">info</span>}
                        <div className="leading-snug">{toast.message}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
