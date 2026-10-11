'use client';

import React, { useState } from 'react';
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

  // Timer format
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const progressPercent = Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100);

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

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
                • <Cloud className="w-3 h-3 text-primary inline" /> Auto-saved
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

          {/* Digital Timer */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/40 border border-border/60 font-mono text-xs text-foreground font-medium">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{timeFormatted}</span>
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
          <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5">
            Q{currentQuestionIndex + 1}
          </Badge>

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
                  'w-full text-left p-3 rounded-md border text-xs sm:text-sm flex items-start gap-3 transition-colors',
                  optionStyle
                )}
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
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </Button>

          <div className="flex items-center gap-2">
            {/* Check Button (Instant Mode) */}
            {isInstantMode && !isChecked && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => checkAnswer(currentQuestionIndex)}
                className="h-8 text-xs font-medium gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Check Answer</span>
              </Button>
            )}

            {/* Next or Finish Button */}
            {currentQuestionIndex < totalQuestions - 1 ? (
              <Button
                size="sm"
                onClick={nextQuestion}
                className="h-8 text-xs font-medium gap-1 bg-primary text-primary-foreground"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={finishQuiz}
                className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4"
              >
                <span>Finish Quiz</span>
                <Send className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
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
