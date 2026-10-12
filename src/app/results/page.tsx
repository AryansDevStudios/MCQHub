'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { ViewSwitcher } from '@/components/layout/ViewSwitcher';

export default function ResultsPage() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('results');
  }, [setView]);

  return <ViewSwitcher initialRoute="results" />;
}
