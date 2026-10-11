'use client';

import React, { useState } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { UserAuthDialog } from '@/components/auth/UserAuthDialog';
import { Database, Cpu, Cloud, User, Check, Zap } from 'lucide-react';

export function StatusBar() {
  const { user, heuristicStatus, isInstantMode, activeQuiz, currentQuestionIndex } = useQuiz();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <footer className="fixed bottom-0 left-0 right-0 z-30 h-6 bg-muted/60 border-t border-border/80 px-3 text-[11px] font-mono text-muted-foreground flex items-center justify-between select-none">
        {/* Left Section */}
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Storage Connectivity Item */}
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors shrink-0"
            title="Click to inspect Cloud Firestore Database & Heuristic Status"
          >
            <Database className="w-3 h-3 text-primary" />
            <span className="hidden sm:inline">Firestore:</span>
            <span className="text-foreground">mcqhub-724e3</span>
            {heuristicStatus && (
              <span className={heuristicStatus.ok ? 'text-emerald-400' : 'text-amber-400'}>
                ({heuristicStatus.latencyMs}ms)
              </span>
            )}
          </button>

          <span className="text-border hidden md:inline">|</span>

          {/* Model Item */}
          <div className="hidden md:flex items-center gap-1 shrink-0">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>gemini-2.5-flash-lite</span>
          </div>

          <span className="text-border hidden lg:inline">|</span>

          {/* Cloudflare Worker Item */}
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            <Cloud className="w-3 h-3 text-sky-400" />
            <span>CF-Worker Gateway</span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Active Exam Progress */}
          {activeQuiz && (
            <div className="flex items-center gap-1 text-primary">
              <span>Q{currentQuestionIndex + 1}/{activeQuiz.questions.length}</span>
            </div>
          )}

          {/* Mode */}
          <div className="hidden sm:flex items-center gap-1">
            <span>Mode:</span>
            <span className="text-foreground">{isInstantMode ? 'Instant' : 'Normal'}</span>
          </div>

          <span className="text-border hidden sm:inline">|</span>

          {/* User */}
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <User className="w-3 h-3" />
            <span className="text-foreground max-w-[80px] truncate">
              {user ? user.username : 'Guest'}
            </span>
          </button>

          <span className="text-border hidden sm:inline">|</span>
          <span className="hidden sm:inline">UTF-8</span>
        </div>
      </footer>

      <UserAuthDialog open={dialogOpen} onOpenChange={setDialogOpen} defaultTab="heuristic" />
    </>
  );
}
