'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { ViewSwitcher } from '@/components/layout/ViewSwitcher';

export default function QuizPage() {
  const { setView, activeQuiz, activeExamSession } = useQuiz();

  useEffect(() => {
    if (activeQuiz || activeExamSession) {
      setView('quiz');
    }
  }, [setView, activeQuiz, activeExamSession]);

  return <ViewSwitcher />;
}
