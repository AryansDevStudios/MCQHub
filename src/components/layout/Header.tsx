'use client';

import React, { useState } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { Logo } from '@/components/icons';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserAuthDialog } from '@/components/auth/UserAuthDialog';
import { Button } from '@/components/ui/button';
import {
  Wand2,
  FileCode2,
  BookmarkCheck,
  History,
  Activity,
  User,
  PlayCircle,
  BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewState } from '@/lib/types';

export function Header() {
  const { view, setView, user, heuristicStatus, isCheckingHeuristic, activeQuiz, history: attemptHistory } = useQuiz();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogTab, setAuthDialogTab] = useState<'auth' | 'sessions' | 'heuristic'>('auth');

  const openAuthWithTab = (tab: 'auth' | 'sessions' | 'heuristic') => {
    setAuthDialogTab(tab);
    setAuthDialogOpen(true);
  };

  const navItems: { id: ViewState; label: string; icon: React.ReactNode; ext: string }[] = [
    { id: 'home', label: 'Generator', icon: <Wand2 className="w-3.5 h-3.5" />, ext: '.ai' },
    { id: 'editor', label: 'JSON Studio', icon: <FileCode2 className="w-3.5 h-3.5" />, ext: '.json' },
    { id: 'library', label: 'Library', icon: <BookmarkCheck className="w-3.5 h-3.5" />, ext: '.store' },
    { id: 'history', label: 'History', icon: <History className="w-3.5 h-3.5" />, ext: '.log' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-sm select-none">
        <div className="flex h-11 items-center justify-between px-3 md:px-4">
          
          {/* Brand & Editor Tabs */}
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
            {/* Logo & Name */}
            <button
              onClick={() => setView('home')}
              className="flex items-center gap-2 pr-2 hover:opacity-85 transition-opacity shrink-0"
            >
              <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Logo className="w-4 h-4" />
              </div>
              <span className="font-semibold text-xs tracking-tight font-mono text-foreground">
                MCQHub<span className="text-primary font-bold">.io</span>
              </span>
            </button>

            {/* Separator */}
            <div className="h-4 w-[1px] bg-border/80 shrink-0 hidden sm:block" />

            {/* Navigation Tabs (VS Code Tab Aesthetic) */}
            <nav className="flex items-center gap-1 shrink-0">
              {navItems.map((item) => {
                const isActive = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={cn(
                      'group flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors font-mono',
                      isActive
                        ? 'bg-muted text-foreground border border-border/70 shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    )}
                  >
                    <span className={cn('transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}>
                      {item.icon}
                    </span>
                    <span className="font-medium text-[11px]">{item.label}</span>
                    <span className="text-[10px] opacity-40 group-hover:opacity-70">{item.ext}</span>
                  </button>
                );
              })}

              {/* Dynamic Active Exam Tab */}
              {activeQuiz && (
                <button
                  onClick={() => setView('quiz')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors font-mono',
                    view === 'quiz'
                      ? 'bg-primary/15 text-primary border border-primary/30 font-semibold'
                      : 'text-sky-400/80 hover:text-sky-300 hover:bg-primary/10'
                  )}
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span className="text-[11px] truncate max-w-[100px]">Active Exam</span>
                </button>
              )}

              {/* Dynamic Results Tab */}
              {view === 'results' && (
                <button
                  onClick={() => setView('results')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Results</span>
                </button>
              )}
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            
            {/* Firebase Storage Heuristic Pill */}
            <button
              onClick={() => openAuthWithTab('heuristic')}
              className={cn(
                'flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border transition-colors',
                heuristicStatus?.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
              )}
              title="Cloud Firestore Heuristic Check"
            >
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  heuristicStatus?.ok ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                )}
              />
              <span className="hidden md:inline">Firestore:</span>
              <span>{heuristicStatus?.ok ? `${heuristicStatus.latencyMs}ms` : 'Ready'}</span>
            </button>

            {/* User Account Pill */}
            <button
              onClick={() => openAuthWithTab('auth')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border border-border/70 hover:bg-muted/50 text-foreground transition-colors"
            >
              <User className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] max-w-[90px] truncate">
                {user ? user.displayName : 'Sign In'}
              </span>
            </button>

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Auth & Diagnostic Dialog */}
      <UserAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        defaultTab={authDialogTab}
      />
    </>
  );
}
