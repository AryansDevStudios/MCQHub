'use client';

import React, { useState } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { Logo } from '@/components/icons';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserAuthDialog } from '@/components/auth/UserAuthDialog';
import {
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
    { id: 'home', label: 'Create', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'editor', label: 'Custom JSON', icon: <FileCode2 className="w-3.5 h-3.5" /> },
    { id: 'library', label: 'Library', icon: <BookmarkCheck className="w-3.5 h-3.5" /> },
    { id: 'history', label: 'History', icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md select-none transition-colors">
        <div className="flex h-12 items-center justify-between px-2.5 sm:px-4">
          
          {/* Left: Brand & Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Logo & Brand */}
            <button
              onClick={() => setView('home')}
              className="flex items-center gap-2 pr-1 sm:pr-2 hover:opacity-85 transition-opacity shrink-0"
              title="MCQHub Home"
            >
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-border/70 flex items-center justify-center shadow-xs shrink-0 bg-card">
                <Logo className="w-full h-full object-cover" />
              </div>
              <span className="font-bold text-sm tracking-tight text-foreground hidden sm:inline">
                MCQHub
              </span>
            </button>

            {/* Separator */}
            <div className="h-4 w-[1px] bg-border/80 shrink-0 hidden sm:block" />

            {/* Navigation Tabs (Mobile: Icons Only, Desktop: Icon + Text) */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                      isActive
                        ? 'bg-primary/15 text-primary border border-primary/30 shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                    title={item.label}
                  >
                    <span className={cn('transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}>
                      {item.icon}
                    </span>
                    <span className="hidden md:inline text-xs">{item.label}</span>
                    {item.id === 'home' && activeExamSession && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Unsubmitted quiz in progress" />
                    )}
                    {item.id === 'history' && activeExamSession && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Unsubmitted quiz in progress" />
                    )}
                  </button>
                );
              })}

              {/* Green Resume Button (Only displayed when a quiz is unsubmitted; disappears when submitted) */}
              {activeExamSession && (
                <button
                  type="button"
                  onClick={resumeActiveExam}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs animate-in fade-in transition-all shrink-0 ml-0.5"
                  title={`Resume unsubmitted test: "${activeExamSession.quiz.title}"`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline text-xs">Resume</span>
                </button>
              )}
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Open Shared Quiz Button */}
            <button
              onClick={() => setJoinModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border/80 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Open test by Share Code or Link"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline text-xs">Join / Code</span>
            </button>

            {/* User Account Button */}
            <button
              onClick={() => openAuthWithTab('auth')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border/80 hover:bg-muted/50 text-foreground transition-colors"
              title={user ? `Logged in as @${user.username}` : 'Sign In / Account'}
            >
              <User className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline text-xs max-w-[100px] truncate">
                {user ? user.displayName : 'Sign In'}
              </span>
            </button>

            {/* Dedicated Settings Button */}
            <button
              onClick={() => openAuthWithTab('settings')}
              className="p-1.5 rounded-md border border-border/80 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
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
