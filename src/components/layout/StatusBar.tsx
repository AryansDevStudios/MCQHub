'use client';

import React from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { Cloud, CloudCheck, User, Sparkles } from 'lucide-react';

export function StatusBar() {
  const { user, isSyncing, activeQuiz, currentQuestionIndex } = useQuiz();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 h-6 bg-muted/40 border-t border-border/80 px-3 text-[11px] text-muted-foreground flex items-center justify-between select-none backdrop-blur-xs">
      {/* Left Section: Cloud / Local Status */}
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="flex items-center gap-1.5 shrink-0">
          <Cloud className="w-3 h-3 text-primary" />
          <span>
            {user ? (isSyncing ? 'Syncing with Cloud...' : 'Cloud Synced') : 'Local Mode'}
          </span>
        </div>

        {/* Active Exam Progress */}
        {activeQuiz && (
          <>
            <span className="text-border">|</span>
            <span className="text-primary font-medium">
              Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}
            </span>
          </>
        )}
      </div>

      {/* Right Section: User & Brand */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-1">
          <User className="w-3 h-3 text-muted-foreground" />
          <span className="text-foreground max-w-[120px] truncate">
            {user ? user.displayName : 'Guest'}
          </span>
        </div>

        <span className="text-border hidden sm:inline">|</span>
        <span className="hidden sm:inline text-muted-foreground/80">
          Aryan&apos;s Dev Studios
        </span>
      </div>
    </footer>
  );
}
