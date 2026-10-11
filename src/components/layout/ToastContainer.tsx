'use client';

import React from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ToastContainer() {
  const { toasts, removeToast } = useQuiz();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-9 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 p-3 rounded-md border text-xs shadow-lg backdrop-blur-md transition-all animate-in slide-in-from-right-5 fade-in',
            toast.type === 'success' && 'bg-emerald-950/90 text-emerald-100 border-emerald-800/80',
            toast.type === 'error' && 'bg-rose-950/90 text-rose-100 border-rose-800/80',
            toast.type === 'info' && 'bg-zinc-900/90 text-zinc-100 border-zinc-700/80'
          )}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}
          
          <div className="flex-1 leading-snug">{toast.message}</div>
          
          <button
            onClick={() => removeToast(toast.id)}
            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded hover:bg-white/10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
