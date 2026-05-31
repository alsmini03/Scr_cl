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
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none p-6">
            <div className="flex flex-col gap-3 w-full max-w-[200px]">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={cn(
                            "w-full p-3 rounded-xl shadow-[0_15px_35px_rgba(0,0,0,0.3)] text-white font-bold text-center animate-fade-in pointer-events-auto backdrop-blur-3xl border border-white/10",
                            toast.type === 'success' ? "bg-primary/90" :
                            toast.type === 'error' ? "bg-red-500/90" : "bg-slate-800/90"
                        )}
                    >
                        <span className="material-symbols-outlined text-2xl mb-0.5 block">
                            {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
                        </span>
                        <div className="text-[13px] leading-tight break-words whitespace-pre-wrap">{toast.message}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
