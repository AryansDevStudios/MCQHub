'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { ViewSwitcher } from '@/components/layout/ViewSwitcher';

export default function EditorPage() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('editor');
  }, [setView]);

  return <ViewSwitcher initialRoute="editor" />;
}
