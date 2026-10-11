'use client';

import React, { useState, useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock,
  Shuffle,
  FileEdit,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Lightbulb,
  Check,
  Cloud,
  Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function QuizView() {
  const {
    activeQuiz,
    userAnswers,
    questionNotes,
    currentQuestionIndex,
    isInstantMode,
    setIsInstantMode,
    checkedQuestions,
    elapsedSeconds,
    elapsedMs,
    clockSkewMs,
    originDeviceId,
    selectAnswer,
    checkAnswer,
    shuffleOptions,
    saveQuestionNote,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    finishQuiz,
    setView,
    user,
  } = useQuiz();

  const [showNoteInput, setShowNoteInput] = useState(false);

  // Full Keyboard-Driven Assessment Navigation & Option Selection
  useEffect(() => {
    if (!activeQuiz || !activeQuiz.questions || activeQuiz.questions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Never intercept when user is typing in a textarea, input, or contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('input') ||
          target.closest('textarea'))
      ) {
        return;
      }

      // 2. Ignore if a modal / alert dialog is currently open
      if (document.querySelector('[role="dialog"][data-state="open"]')) {
        return;
      }

      const currentQ = activeQuiz.questions[currentQuestionIndex];
      if (!currentQ) return;
      const totalQ = activeQuiz.questions.length;
      const isCurChecked = !!checkedQuestions[currentQuestionIndex];
      const curSelected = userAnswers[currentQuestionIndex];

      // 3. Option Selection: Keys 1 through 9 (standard top-row numbers or numpad)
      const numMatch = e.code.match(/^(Digit|Numpad)([1-9])$/);
      if (numMatch) {
        const optionNum = parseInt(numMatch[2], 10);
        const optIdx = optionNum - 1;
        if (currentQ.options && optIdx < currentQ.options.length) {
          if (!(isInstantMode && isCurChecked)) {
            e.preventDefault();
            selectAnswer(currentQuestionIndex, optIdx);
          }
        }
        return;
      }

      // 4. Arrow Navigation (Left = Previous, Right = Next)
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentQuestionIndex > 0) {
          prevQuestion();
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentQuestionIndex < totalQ - 1) {
          nextQuestion();
        }
        return;
      }

      // 5. Up / Down Arrows (Cycle through choices)
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!(isInstantMode && isCurChecked) && currentQ.options && currentQ.options.length > 0) {
          e.preventDefault();
          const numOptions = currentQ.options.length;
          let nextOpt = 0;
          if (curSelected === undefined) {
            nextOpt = e.key === 'ArrowDown' ? 0 : numOptions - 1;
          } else {
            if (e.key === 'ArrowDown') {
              nextOpt = (curSelected + 1) % numOptions;
            } else {
              nextOpt = (curSelected - 1 + numOptions) % numOptions;
            }
          }
          selectAnswer(currentQuestionIndex, nextOpt);
        }
        return;
      }

      // 6. Enter or Spacebar: Mark question done / Next question / Finish Exam
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();

        if (isInstantMode) {
          if (!isCurChecked) {
            // Check current question answer
            checkAnswer(currentQuestionIndex);
          } else {
            // Already checked: advance to next or finish
            if (currentQuestionIndex < totalQ - 1) {
              nextQuestion();
            } else {
              finishQuiz();
            }
          }
        } else {
          // Standard examination mode: Advance or submit
          if (currentQuestionIndex < totalQ - 1) {
            nextQuestion();
          } else {
            finishQuiz();
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeQuiz,
    currentQuestionIndex,
    checkedQuestions,
    userAnswers,
    isInstantMode,
    selectAnswer,
    checkAnswer,
    nextQuestion,
    prevQuestion,
    finishQuiz,
  ]);

  if (!activeQuiz || !activeQuiz.questions || activeQuiz.questions.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <h2 className="text-base font-semibold">No active quiz loaded.</h2>
        <Button onClick={() => setView('home')} size="sm">
          Return to Home
        </Button>
      </div>
    );
  }

  const currentQuestion = activeQuiz.questions[currentQuestionIndex];
  const totalQuestions = activeQuiz.questions.length;
  const isChecked = !!checkedQuestions[currentQuestionIndex];
  const selectedOptionIndex = userAnswers[currentQuestionIndex];
  const currentNote = questionNotes[currentQuestionIndex] || '';

  // Ultra-accurate Millisecond Timer format
  const totalMs = elapsedMs || elapsedSeconds * 1000;
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const millis = Math.floor(totalMs % 1000);
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const msFormatted = String(millis).padStart(3, '0');

  const progressPercent = Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100);

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 pb-20 space-y-5">
      
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-primary font-semibold">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </span>
            <span className="text-border text-xs">•</span>
            <span className="text-xs text-muted-foreground truncate max-w-[220px]">
              {activeQuiz.title}
            </span>
            {user && (
              <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1 font-mono">
                • <Cloud className="w-3 h-3 text-primary inline" /> Edge Synced
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Instant Mode Switch */}
          <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded border border-border/60">
            <Label htmlFor="exam-instant" className="text-[11px] cursor-pointer text-muted-foreground">
              Instant Check
            </Label>
            <Switch
              id="exam-instant"
              checked={isInstantMode}
              onCheckedChange={setIsInstantMode}
              className="scale-75"
            />
          </div>

          {/* Synchronized Master Clock (Millisecond-accurate across devices) */}
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-muted/40 border border-border/60 font-mono text-xs text-foreground font-medium select-none shadow-2xs"
            title={`Edge-Synchronized Clock (±1ms, Origin: ${originDeviceId || 'Master'})`}
          >
            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{timeFormatted}</span>
            <span className="text-[10px] text-primary/70 font-mono">.{msFormatted}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden border border-border/40">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-6 space-y-5 shadow-xs">
        
        {/* Question Shelf Tools */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/50 pb-2.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5">
              Q{currentQuestionIndex + 1}
            </Badge>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80 font-mono">
              <Keyboard className="w-3 h-3 text-primary" />
              <span>Keys 1–{Math.min(9, currentQuestion.options.length)} • Enter/Space • Arrows</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Note Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNoteInput(!showNoteInput)}
              className={cn(
                'h-7 px-2 text-xs gap-1',
                currentNote ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              )}
              title="Add personal note"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>{currentNote ? 'Note Added' : 'Add Note'}</span>
            </Button>

            {/* Shuffle Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => shuffleOptions(currentQuestionIndex)}
              disabled={isInstantMode && isChecked}
              className="h-7 px-2 text-xs text-muted-foreground gap-1"
              title="Shuffle option order"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Shuffle</span>
            </Button>
          </div>
        </div>

        {/* Question Text */}
        <div className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
          <MarkdownRenderer content={currentQuestion.question} />
        </div>

        {/* Options List */}
        <div className="space-y-2 pt-1">
          {currentQuestion.options.map((option, optIdx) => {
            const isSelected = selectedOptionIndex === optIdx;
            const isCorrectAnswer = optIdx === currentQuestion.correctAnswer;

            // Compute styling
            let optionStyle = 'border-border/70 hover:bg-muted/40 hover:border-border';
            let badgeStyle = 'bg-muted text-muted-foreground';

            if (isInstantMode && isChecked) {
              if (isCorrectAnswer) {
                optionStyle = 'bg-emerald-500/10 border-emerald-500/50 text-foreground';
                badgeStyle = 'bg-emerald-500 text-white font-bold';
              } else if (isSelected) {
                optionStyle = 'bg-rose-500/10 border-rose-500/50 text-foreground';
                badgeStyle = 'bg-rose-500 text-white font-bold';
              } else {
                optionStyle = 'opacity-50 border-border/40';
              }
            } else if (isSelected) {
              optionStyle = 'bg-primary/10 border-primary text-primary font-medium shadow-xs';
              badgeStyle = 'bg-primary text-primary-foreground font-bold';
            }

            return (
              <button
                key={optIdx}
                type="button"
                disabled={isInstantMode && isChecked}
                onClick={() => selectAnswer(currentQuestionIndex, optIdx)}
                className={cn(
                  'group w-full text-left p-3 rounded-md border text-xs sm:text-sm flex items-start gap-3 transition-colors',
                  optionStyle
                )}
                title={optIdx < 9 ? `Option ${optionLetters[optIdx] || optIdx + 1} (Press ${optIdx + 1} on keyboard)` : undefined}
              >
                <div
                  className={cn(
                    'w-6 h-6 rounded flex items-center justify-center shrink-0 font-mono text-xs transition-colors',
                    badgeStyle
                  )}
                >
                  {optionLetters[optIdx] || optIdx + 1}
                </div>

                <div className="flex-1 pt-0.5 leading-snug">
                  <MarkdownRenderer content={option} inline />
                </div>

                {/* Keyboard shortcut hint for keys 1-9 */}
                {optIdx < 9 && !(isInstantMode && isChecked) && (
                  <span
                    className={cn(
                      'hidden sm:inline-flex items-center justify-center font-mono text-[10px] px-1.5 py-0.5 rounded border shrink-0 select-none transition-colors opacity-60 group-hover:opacity-100',
                      isSelected
                        ? 'border-primary/40 bg-primary/20 text-primary font-bold'
                        : 'border-border/60 bg-muted/40 text-muted-foreground'
                    )}
                    title={`Press key ${optIdx + 1} to select`}
                  >
                    [{optIdx + 1}]
                  </span>
                )}

                {isInstantMode && isChecked && (
                  <div className="shrink-0 pt-0.5">
                    {isCorrectAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {isSelected && !isCorrectAnswer && <XCircle className="w-4 h-4 text-rose-500" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Instant Explanation Box */}
        {isInstantMode && isChecked && currentQuestion.explanation && (
          <div className="p-3.5 rounded-md border border-primary/30 bg-primary/5 text-xs text-foreground space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Explanation</span>
            </div>
            <div className="leading-relaxed">
              <MarkdownRenderer content={currentQuestion.explanation} />
            </div>
          </div>
        )}

        {/* Note Input */}
        {showNoteInput && (
          <div className="p-3 rounded-md border border-border/70 bg-muted/20 space-y-2">
            <Label className="text-xs text-muted-foreground font-medium">Question Note</Label>
            <Textarea
              value={currentNote}
              onChange={(e) => saveQuestionNote(currentQuestionIndex, e.target.value)}
              placeholder="Record your thoughts, doubts, or formulas for this question..."
              rows={3}
              className="text-xs bg-background"
            />
          </div>
        )}

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            disabled={currentQuestionIndex === 0}
            onClick={prevQuestion}
            className="h-8 text-xs gap-1 border-border/70"
            title="Previous Question (or press ← Left Arrow)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
            <kbd className="hidden sm:inline-block font-mono text-[10px] opacity-60 ml-0.5">←</kbd>
          </Button>

          <div className="flex items-center gap-2">
            {/* Check Button (Instant Mode) */}
            {isInstantMode && !isChecked && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => checkAnswer(currentQuestionIndex)}
                className="h-8 text-xs font-medium gap-1.5"
                title="Check Answer (or press Enter / Space)"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Check Answer</span>
                <kbd className="hidden sm:inline-block font-mono text-[10px] bg-background/80 px-1 py-0.2 rounded border border-border/60 text-muted-foreground">
                  Enter / Space
                </kbd>
              </Button>
            )}

            {/* Next or Finish Button */}
            {currentQuestionIndex < totalQuestions - 1 ? (
              <Button
                size="sm"
                onClick={nextQuestion}
                className="h-8 text-xs font-medium gap-1.5 bg-primary text-primary-foreground"
                title="Next Question (or press Enter / Space / → Right Arrow)"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
                <kbd className="hidden sm:inline-block font-mono text-[10px] bg-primary-foreground/20 text-primary-foreground px-1 py-0.2 rounded">
                  Enter / Space
                </kbd>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={finishQuiz}
                className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4"
                title="Finish Exam (or press Enter / Space)"
              >
                <span>Finish Quiz</span>
                <Send className="w-3.5 h-3.5" />
                <kbd className="hidden sm:inline-block font-mono text-[10px] bg-white/20 text-white px-1 py-0.2 rounded">
                  Enter / Space
                </kbd>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard Controls Helper Banner */}
      <div className="rounded-lg border border-border/50 bg-muted/20 px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          <Keyboard className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground/90">Keyboard Controls:</span>
          <span>
            Press <kbd className="px-1.5 py-0.5 rounded border border-border/70 bg-background font-mono text-[10px] text-foreground">1</kbd>–<kbd className="px-1.5 py-0.5 rounded border border-border/70 bg-background font-mono text-[10px] text-foreground">{Math.min(9, currentQuestion.options.length)}</kbd> to select option
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-muted-foreground/90">
          <span>
            <kbd className="px-1.5 py-0.5 rounded border border-border/70 bg-background font-mono text-[10px] text-foreground">Enter</kbd> / <kbd className="px-1.5 py-0.5 rounded border border-border/70 bg-background font-mono text-[10px] text-foreground">Space</kbd> {isInstantMode && !isChecked ? 'Check Answer' : 'Next / Finish'}
          </span>
          <span>•</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded border border-border/70 bg-background font-mono text-[10px] text-foreground">←</kbd> <kbd className="px-1.5 py-0.5 rounded border border-border/70 bg-background font-mono text-[10px] text-foreground">→</kbd> Navigate questions
          </span>
        </div>
      </div>

      {/* Quick Jump Question Grid */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
        {activeQuiz.questions.map((_, idx) => {
          const isAnswered = userAnswers[idx] !== undefined;
          const isCurrent = idx === currentQuestionIndex;

          return (
            <button
              key={idx}
              onClick={() => goToQuestion(idx)}
              className={cn(
                'w-7 h-7 rounded text-xs font-mono transition-colors border flex items-center justify-center',
                isCurrent
                  ? 'border-primary bg-primary text-primary-foreground font-bold'
                  : isAnswered
                  ? 'border-border/80 bg-muted text-foreground'
                  : 'border-border/40 text-muted-foreground hover:bg-muted/40'
              )}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

    </div>
  );
}
