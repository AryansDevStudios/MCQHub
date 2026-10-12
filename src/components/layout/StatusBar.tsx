'use client';

import React from 'react';
import { useQuiz } from '@/context/QuizProvider';

export function StatusBar() {
  const { user, isSyncing, view, activeQuiz, currentQuestionIndex, isHydrated } = useQuiz();

  const syncStatus = !isHydrated
    ? 'Local Mode'
    : user
    ? isSyncing
      ? 'Syncing...'
      : 'Cloud Synced'
    : 'Local Mode';

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 h-6 bg-card border-t border-border px-4 text-[11px] text-muted-foreground font-mono flex items-center justify-between select-none">
      {/* Left Section: Cloud / Local Status & Active Quiz Progress */}
      <div className="flex items-center gap-2 overflow-hidden">
        <span>{syncStatus}</span>

        {isHydrated && view === 'quiz' && activeQuiz && (
          <>
            <span className="text-border">·</span>
            <span>
              Question {currentQuestionIndex + 1} of {activeQuiz.questions?.length ?? 0}
            </span>
          </>
        )}
      </div>

      {/* Right Section: Brand Attribution */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-muted-foreground/60">
          Aryan&apos;s Dev Studios
        </span>
      </div>
    </footer>
  );
}
