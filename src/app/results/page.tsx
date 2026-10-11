'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { ResultsView } from '@/components/views/ResultsView';

export default function ResultsPage() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('results');
  }, [setView]);

  return <ResultsView />;
}
