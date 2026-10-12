'use client';

import React, { useState, useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Clock,
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
  Loader2,
  AlertCircle,
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
    saveQuestionNote,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    finishQuiz,
    setView,
    user,
    isLoadingSharedQuiz,
  } = useQuiz();

  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);

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

      const totalQ = activeQuiz.questions.length;
      const safeIdx = Math.min(Math.max(0, currentQuestionIndex), totalQ - 1);
      const currentQ = activeQuiz.questions[safeIdx];
      if (!currentQ) return;
      const isCurChecked = !!checkedQuestions[safeIdx];
      const curSelected = userAnswers[safeIdx];

      // 3. Option Selection: Keys 1 through 9 or letter keys A through L
      let optIdx: number | null = null;
      const numMatch = e.code.match(/^(Digit|Numpad)([1-9])$/);
      if (numMatch) {
        optIdx = parseInt(numMatch[2], 10) - 1;
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const keyUpper = e.key.toUpperCase();
        if (keyUpper.length === 1 && keyUpper >= 'A' && keyUpper <= 'L') {
          optIdx = keyUpper.charCodeAt(0) - 65;
        }
      }

      if (optIdx !== null) {
        if (currentQ.options && optIdx >= 0 && optIdx < currentQ.options.length) {
          if (!(isInstantMode && isCurChecked)) {
            e.preventDefault();
            selectAnswer(safeIdx, optIdx);
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
    const isSharedUrlPresent = typeof window !== 'undefined' && !!(
      new URLSearchParams(window.location.search).get('share') ||
      new URLSearchParams(window.location.search).get('test') ||
      new URLSearchParams(window.location.search).get('code') ||
      new URLSearchParams(window.location.search).get('quiz')
    );

    if (isLoadingSharedQuiz || isSharedUrlPresent) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-3">Loading assessment...</p>
        </div>
      );
    }

    return (
      <div className="max-w-sm mx-auto py-20 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
        <h2 className="text-base font-medium text-foreground">No active quiz loaded</h2>
        <p className="text-sm text-muted-foreground">
          Please select a quiz from your Library, generate a new one with AI, or import JSON to get started.
        </p>
        <div className="pt-2">
          <Button
            onClick={() => setView('home')}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm hover:bg-primary/90"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  const totalQuestions = activeQuiz.questions.length;
  const safeQuestionIndex = Math.min(Math.max(0, currentQuestionIndex), Math.max(0, totalQuestions - 1));
  const currentQuestion = activeQuiz.questions[safeQuestionIndex] || activeQuiz.questions[0];
  const isChecked = !!checkedQuestions[safeQuestionIndex];
  const selectedOptionIndex = userAnswers[safeQuestionIndex];
  const currentNote = questionNotes[safeQuestionIndex] || '';

  // Ultra-accurate Millisecond Timer format
  const totalMs = elapsedMs || elapsedSeconds * 1000;
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const millis = Math.floor(totalMs % 1000);
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const msFormatted = String(millis).padStart(3, '0');

  const progressPercent = Math.round(((safeQuestionIndex + 1) / totalQuestions) * 100);

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Question <span className="text-foreground font-semibold">{safeQuestionIndex + 1}</span> of{' '}
            <span className="text-foreground font-semibold">{totalQuestions}</span>
          </span>
          {user && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground font-mono">
              • <Cloud className="w-3 h-3 text-primary" /> Synced
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Instant Mode Switch */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Label htmlFor="exam-instant" className="text-xs cursor-pointer text-muted-foreground">
              Instant Check
            </Label>
            <Switch
              id="exam-instant"
              checked={isInstantMode}
              onCheckedChange={setIsInstantMode}
              className="scale-90"
            />
          </div>

          {/* Timer: Minimal, no container box, pulsing dot */}
          <div
            className="flex items-center gap-2 font-mono text-sm text-foreground font-medium select-none"
            title={`Elapsed Time (${clockSkewMs !== undefined ? `Skew: ${clockSkewMs}ms, ` : ''}Origin: ${originDeviceId || 'Master'})`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>
              {timeFormatted}
              <span className="text-xs text-muted-foreground">.{msFormatted}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-[2px] bg-border rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Question Shelf */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <span className="font-mono text-xs text-primary bg-primary/10 rounded-full px-2.5 py-0.5 font-medium">
            Question {safeQuestionIndex + 1}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNoteInput(!showNoteInput)}
              className={cn(
                'text-xs flex items-center gap-1.5 transition-colors',
                currentNote ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Add personal note"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>{currentNote ? 'Note Added' : 'Add Note'}</span>
            </button>
          </div>
        </div>

        {/* Question Text */}
        <div className="text-lg font-semibold text-foreground leading-relaxed tracking-tight">
          <MarkdownRenderer content={currentQuestion.question} />
        </div>

        {/* Options */}
        <div className="space-y-2.5 pt-1">
          {(currentQuestion.options || []).map((option, optIdx) => {
            const isSelected = selectedOptionIndex === optIdx;
            const isCorrectAnswer = optIdx === currentQuestion.correctAnswer;

            let optionWrapperStyle = 'hover:bg-secondary/50 hover:border-border/80 border-border bg-background';
            let keyBadgeStyle = 'bg-card border-border text-muted-foreground';

            if (isInstantMode && isChecked) {
              if (isCorrectAnswer) {
                optionWrapperStyle = 'border-green-600/30 bg-green-50 dark:bg-green-950/20';
                keyBadgeStyle = 'bg-green-600 text-white border-green-600';
              } else if (isSelected) {
                optionWrapperStyle = 'border-destructive/30 bg-destructive/5';
                keyBadgeStyle = 'bg-destructive text-white border-destructive';
              } else {
                optionWrapperStyle = 'border-border/40 opacity-40 bg-background';
              }
            } else if (isSelected) {
              optionWrapperStyle = 'border-primary bg-primary/5 shadow-sm';
              keyBadgeStyle = 'bg-primary text-primary-foreground border-primary';
            }

            return (
              <button
                key={optIdx}
                type="button"
                disabled={isInstantMode && isChecked}
                onClick={() => selectAnswer(safeQuestionIndex, optIdx)}
                className={cn(
                  'w-full border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all text-left group',
                  optionWrapperStyle
                )}
              >
                <div
                  className={cn(
                    'w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors',
                    keyBadgeStyle
                  )}
                >
                  {optionLetters[optIdx] || optIdx + 1}
                </div>

                <div className="text-sm text-foreground leading-snug flex-1">
                  <MarkdownRenderer content={option} inline />
                </div>

                {isInstantMode && isChecked && (
                  <div className="flex-shrink-0">
                    {isCorrectAnswer && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    {isSelected && !isCorrectAnswer && <XCircle className="w-4 h-4 text-destructive" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation Box */}
        {isInstantMode && isChecked && currentQuestion.explanation && (
          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Lightbulb className="w-4 h-4 text-primary" />
              <span>Explanation</span>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              <MarkdownRenderer content={currentQuestion.explanation} />
            </div>
          </div>
        )}

        {/* Note Input */}
        {showNoteInput && (
          <div className="rounded-xl border border-border bg-background p-4 space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Question Note</Label>
            <Textarea
              value={currentNote}
              onChange={(e) => saveQuestionNote(safeQuestionIndex, e.target.value)}
              placeholder="Record your thoughts, doubts, or formulas for this question..."
              rows={3}
              className="w-full text-sm bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground border-border focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-5 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            disabled={safeQuestionIndex === 0}
            onClick={prevQuestion}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 h-auto"
            title="Previous Question"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </Button>

          <div className="flex items-center gap-2">
            {/* Check Button (Instant Mode) */}
            {isInstantMode && !isChecked && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkAnswer(safeQuestionIndex)}
                className="border border-border rounded-lg px-4 py-2 text-sm hover:bg-secondary transition-colors h-auto font-normal text-foreground"
                title="Check Answer"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                <span>Check Answer</span>
              </Button>
            )}

            {/* Next or Finish Button */}
            {safeQuestionIndex < totalQuestions - 1 ? (
              <Button
                size="sm"
                onClick={nextQuestion}
                className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-medium hover:bg-primary/90 h-auto"
                title="Next Question"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 ml-1.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={finishQuiz}
                className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-medium hover:bg-primary/90 h-auto"
                title="Finish Exam"
              >
                <span>Finish Quiz</span>
                <Send className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Question Jump Grid */}
      <div className="flex flex-wrap justify-center gap-1.5 pt-6">
        {activeQuiz.questions.map((_, idx) => {
          const isAnswered = userAnswers[idx] !== undefined;
          const isCurrent = idx === safeQuestionIndex;

          return (
            <button
              key={idx}
              onClick={() => goToQuestion(idx)}
              className={cn(
                'w-7 h-7 rounded-md text-xs font-mono transition-colors border flex items-center justify-center',
                isCurrent
                  ? 'border-primary bg-primary text-primary-foreground font-semibold'
                  : isAnswered
                  ? 'border-border bg-secondary text-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary'
              )}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Keyboard Shortcuts Trigger Button */}
      <div className="flex items-center justify-center pt-4">
        <button
          type="button"
          onClick={() => setShowShortcutsDialog(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-md"
          title="View Keyboard Shortcuts"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>Keyboard Shortcuts</span>
        </button>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog}>
        <DialogContent className="max-w-xs bg-card border-border rounded-2xl p-5 shadow-xl">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Keyboard className="w-4 h-4 text-primary" />
              <span>Keyboard Controls</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Select Option</span>
              <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs text-foreground">1 – 9 / A – D</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Next / Finish</span>
              <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs text-foreground">Enter / Space</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Previous Question</span>
              <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs text-foreground">← Left</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Next Question</span>
              <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs text-foreground">→ Right</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Cycle Options</span>
              <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs text-foreground">↑ / ↓</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
