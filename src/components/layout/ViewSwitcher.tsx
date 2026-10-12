'use client';

import React from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { HomeView } from '@/components/views/HomeView';
import { JsonEditorView } from '@/components/views/JsonEditorView';
import { QuizView } from '@/components/views/QuizView';
import { ResultsView } from '@/components/views/ResultsView';
import { LibraryView } from '@/components/views/LibraryView';
import { HistoryView } from '@/components/views/HistoryView';

export function ViewSwitcher() {
  const { view } = useQuiz();

  switch (view) {
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
