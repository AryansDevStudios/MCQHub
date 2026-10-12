'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { ViewSwitcher } from '@/components/layout/ViewSwitcher';

export default function LibraryPage() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('library');
  }, [setView]);

  return <ViewSwitcher />;
}
