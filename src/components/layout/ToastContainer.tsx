'use client';

import React from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ToastContainer() {
  const { toasts, removeToast } = useQuiz();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-4 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border text-sm shadow-lg animate-in slide-in-from-right-3 fade-in bg-card',
            toast.type === 'success' && 'border-border border-l-2 border-l-primary',
            toast.type === 'error' && 'border-destructive/30 border-l-2 border-l-destructive',
            toast.type === 'info' && 'border-border border-l-2 border-l-muted-foreground'
          )}
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          )}
          {toast.type === 'error' && (
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && (
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          )}

          <div className="flex-1 text-foreground text-sm leading-snug">
            {toast.message}
          </div>

          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss toast"
            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded hover:bg-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
