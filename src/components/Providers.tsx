'use client';

import React, { useEffect } from 'react';
import { QuizProvider, useQuiz } from '@/context/QuizProvider';
import { Header } from '@/components/layout/Header';
import { StatusBar } from '@/components/layout/StatusBar';
import { ToastContainer } from '@/components/layout/ToastContainer';

function AppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useQuiz();

  useEffect(() => {
    // Synchronize theme on client mount
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="min-h-screen flex flex-col pb-6">
      <Header />
      <main className="flex-1 w-full">
        {children}
      </main>
      <StatusBar />
      <ToastContainer />
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QuizProvider>
      <AppShell>{children}</AppShell>
    </QuizProvider>
  );
}
