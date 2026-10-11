'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { LibraryView } from '@/components/views/LibraryView';

export default function LibraryPage() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('library');
  }, [setView]);

  return <LibraryView />;
}
