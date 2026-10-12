'use client';

import React from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { HomeView } from '@/components/views/HomeView';
import { JsonEditorView } from '@/components/views/JsonEditorView';
import { QuizView } from '@/components/views/QuizView';
import { ResultsView } from '@/components/views/ResultsView';
import { LibraryView } from '@/components/views/LibraryView';
import { HistoryView } from '@/components/views/HistoryView';

import type { ViewState } from '@/lib/types';

export function ViewSwitcher({ initialRoute = 'home' }: { initialRoute?: ViewState }) {
  const { view, isHydrated } = useQuiz();

  // Prior to client hydration, render initialRoute matching the static HTML of this route page.
  // Once hydrated, follow the reactive SPA view state.
  const activeView = isHydrated ? view : initialRoute;

  switch (activeView) {
    case 'editor':
      return <JsonEditorView />;
    case 'quiz':
      return <QuizView />;
    case 'results':
      return <ResultsView />;
    case 'library':
      return <LibraryView />;
    case 'history':
      return <HistoryView />;
    case 'home':
    default:
      return <HomeView />;
  }
}
