'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { ViewSwitcher } from '@/components/layout/ViewSwitcher';

export default function QuizPage() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('quiz');
  }, [setView]);

  return <ViewSwitcher initialRoute="quiz" />;
}
