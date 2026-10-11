'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { QuizView } from '@/components/views/QuizView';

export default function QuizPage() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('quiz');
  }, [setView]);

  return <QuizView />;
}
