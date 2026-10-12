'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useQuiz } from '@/context/QuizProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useQuiz();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-500/80" />
      ) : (
        <Moon className="w-4 h-4 text-stone-500" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}

export default ThemeToggle;
