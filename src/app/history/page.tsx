'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { ViewSwitcher } from '@/components/layout/ViewSwitcher';

export default function HistoryPage() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('history');
  }, [setView]);

  return <ViewSwitcher initialRoute="history" />;
}
