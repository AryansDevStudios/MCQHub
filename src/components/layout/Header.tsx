'use client';

import React, { useState } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserAuthDialog } from '@/components/auth/UserAuthDialog';
import {
  Leaf,
  Sparkles,
  FileCode2,
  BookmarkCheck,
  History,
  User,
  Settings,
  Share2,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewState } from '@/lib/types';

export function Header() {
  const { view, setView, user, setJoinModalOpen, activeExamSession, resumeActiveExam } = useQuiz();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogTab, setAuthDialogTab] = useState<'auth' | 'settings' | 'sessions'>('auth');

  const openAuthWithTab = (tab: 'auth' | 'settings' | 'sessions') => {
    setAuthDialogTab(tab);
    setAuthDialogOpen(true);
  };

  const navItems: { id: ViewState; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Create', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'editor', label: 'Custom JSON', icon: <FileCode2 className="w-4 h-4" /> },
    { id: 'library', label: 'Library', icon: <BookmarkCheck className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full h-14 bg-card border-b border-border select-none transition-colors">
        <div className="flex h-14 items-center justify-between px-3 sm:px-6">
          {/* Left: Brand & Navigation */}
          <div className="flex items-center gap-8 h-full">
            {/* Logo & Brand */}
            <button
              onClick={() => setView('home')}
              className="flex items-center gap-2 hover:opacity-85 transition-opacity shrink-0"
              title="MCQHub Home"
            >
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <Leaf className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold text-sm tracking-tight text-foreground hidden sm:inline">
                MCQHub
              </span>
            </button>

            {/* Navigation Tabs (Underline indicator style) */}
            <nav className="flex items-center gap-2 sm:gap-4 md:gap-6 h-full">
              {navItems.map((item) => {
                const isActive = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 h-14 border-b-2 text-sm font-medium transition-colors relative px-1',
                      isActive
                        ? 'border-primary text-primary font-semibold'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                    title={item.label}
                  >
                    <span className={cn('transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}>
                      {item.icon}
                    </span>
                    <span className="hidden md:inline">{item.label}</span>
                    {item.id === 'home' && activeExamSession && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                        title="Unsubmitted quiz in progress"
                      />
                    )}
                    {item.id === 'history' && activeExamSession && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                        title="Unsubmitted quiz in progress"
                      />
                    )}
                  </button>
                );
              })}

              {/* Resume Button (Solid teal Zen Garden style, shown when quiz session active and not on quiz page) */}
              {activeExamSession && view !== 'quiz' && (
                <button
                  type="button"
                  onClick={resumeActiveExam}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors shrink-0 ml-1"
                  title={`Resume unsubmitted test: "${activeExamSession.quiz?.title || 'Practice Quiz'}"`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Resume</span>
                </button>
              )}
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Open Shared Quiz Button */}
            <button
              onClick={() => setJoinModalOpen(true)}
              className="flex items-center gap-1.5 border border-border rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Open test by Share Code or Link"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Join / Code</span>
            </button>

            {/* User Account Button */}
            <button
              onClick={() => openAuthWithTab('auth')}
              className="flex items-center gap-2 border border-border rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title={user ? `Logged in as @${user.username}` : 'Sign In / Account'}
            >
              <div className="w-7 h-7 rounded-full bg-secondary border border-border text-xs font-semibold text-foreground flex items-center justify-center shrink-0">
                {user ? (
                  user.displayName.charAt(0).toUpperCase()
                ) : (
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <span className="hidden sm:inline max-w-[100px] truncate text-foreground font-medium text-xs">
                {user ? user.displayName : 'Sign In'}
              </span>
            </button>

            {/* Dedicated Settings Button */}
            <button
              onClick={() => openAuthWithTab('settings')}
              className="p-1.5 border border-border rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Settings & API Key"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Auth & Settings Dialog */}
      <UserAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        defaultTab={authDialogTab}
      />
    </>
  );
}
