'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { HistoryView } from '@/components/views/HistoryView';

export default function HistoryPage() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('history');
  }, [setView]);

  return <HistoryView />;
}
