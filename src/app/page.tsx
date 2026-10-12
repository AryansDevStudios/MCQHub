'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { ViewSwitcher } from '@/components/layout/ViewSwitcher';

export default function Page() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('home');
  }, [setView]);

  return <ViewSwitcher />;
}
