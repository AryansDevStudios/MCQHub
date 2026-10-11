'use client';

import React, { useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { JsonEditorView } from '@/components/views/JsonEditorView';

export default function EditorPage() {
  const { setView } = useQuiz();

  useEffect(() => {
    setView('editor');
  }, [setView]);

  return <JsonEditorView />;
}
