'use client';

import React, { useState } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  History as HistoryIcon,
  Clock,
  ChevronRight,
  Trash2,
  Calendar,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizAttempt } from '@/lib/types';

export function HistoryView() {
  const {
    history,
    clearHistory,
    deleteHistoryAttempt,
    viewAttemptResult,
    setView,
    user,
    lastSyncTime,
    activeExamSession,
    resumeActiveExam,
    discardActiveExam,
    isHydrated,
  } = useQuiz();

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [attemptToDelete, setAttemptToDelete] = useState<QuizAttempt | null>(null);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
      
      {/* Header */}
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-primary font-medium">
              Quiz History
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Past Quiz Attempts
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {user ? (
              <span>
                Synced to your account (<strong className="text-foreground">@{user.username}</strong>)
                {lastSyncTime && (
                  <span className="text-[11px] opacity-75 font-mono ml-2">
                    • Last synced {new Date(lastSyncTime).toLocaleTimeString()}
                  </span>
                )}
              </span>
            ) : (
              'Saved locally on this device. Sign in to sync across your laptop and phone.'
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClearDialog(true)}
              className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </Button>
          )}
        </div>
      </div>

      {/* Active Exam Banner */}
      {isHydrated && activeExamSession && (
        <div className="border border-border bg-card rounded-2xl p-5 border-l-4 border-l-primary space-y-3 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-[10px] text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium">
                  Unsubmitted Quiz (In Progress)
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Question {(activeExamSession.currentQuestionIndex || 0) + 1} of {activeExamSession.quiz.questions?.length ?? 1}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                {activeExamSession.quiz.title || 'Untitled Quiz'}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  Answered <strong>{Object.keys(activeExamSession.userAnswers || {}).length}</strong> of {activeExamSession.quiz.questions?.length ?? 0} questions
                </span>
                <span>•</span>
                <span>
                  Progress: {Math.round((Object.keys(activeExamSession.userAnswers || {}).length / Math.max(1, activeExamSession.quiz.questions?.length ?? 1)) * 100)}%
                </span>
                {activeExamSession.elapsedSeconds > 0 && (
                  <>
                    <span>•</span>
                    <span className="font-mono">
                      Elapsed: {Math.floor(activeExamSession.elapsedSeconds / 60)}m {activeExamSession.elapsedSeconds % 60}s
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Button
                size="sm"
                variant="outline"
                onClick={discardActiveExam}
                className="h-8 text-xs border-border bg-transparent hover:bg-secondary text-muted-foreground hover:text-destructive rounded-lg"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={resumeActiveExam}
                className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5 px-4 rounded-lg"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Quiz</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Attempts List */}
      {history.length === 0 ? (
        !activeExamSession && (
          <div className="py-16 text-center rounded-2xl border border-dashed border-border/70 p-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
              <HistoryIcon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No completed quiz attempts yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Take a practice quiz or start one from your Library to see your scores and feedback here.
            </p>
            <Button
              size="sm"
              onClick={() => setView('home')}
              className="h-8 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
            >
              Create a Quiz
            </Button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {activeExamSession && (
            <div className="text-xs font-medium text-muted-foreground pt-1">
              Completed Quiz History ({history.length})
            </div>
          )}
          {history.map((attempt) => {
            const pct = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;
            const isHigh = pct >= 80;
            const isMedium = pct >= 50 && pct < 80;

            const scoreBadgeColor = isHigh
              ? 'bg-primary/10 text-primary'
              : isMedium
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-destructive/10 text-destructive';

            return (
              <div
                key={attempt.id}
                className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-sm transition-all"
              >
                {/* Score Badge */}
                <div
                  className={cn(
                    'w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-bold flex-shrink-0',
                    scoreBadgeColor
                  )}
                >
                  <span className="text-sm leading-none">{pct}%</span>
                  <span className="text-[9px] font-normal uppercase opacity-70 mt-0.5">
                    {attempt.score}/{attempt.total}
                  </span>
                </div>

                {/* Attempt Info */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      onClick={() => viewAttemptResult(attempt)}
                      className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer transition-colors truncate"
                    >
                      {attempt.quizTitle || 'Untitled Quiz'}
                    </h3>
                    <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                      {attempt.mode === 'Instant' ? 'Instant Mode' : 'Standard'}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground/70" />
                      {attempt.date && !isNaN(new Date(attempt.date).getTime())
                        ? new Date(attempt.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Recent'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground/70" />
                      {attempt.timeSpent}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 shrink-0">
                  <button
                    type="button"
                    onClick={() => viewAttemptResult(attempt)}
                    className="border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center gap-1.5 transition-colors"
                  >
                    <span>Review Answers</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttemptToDelete(attempt)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md"
                    title="Delete this attempt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single Attempt Delete Confirmation Modal */}
      <AlertDialog open={!!attemptToDelete} onOpenChange={(open) => !open && setAttemptToDelete(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border text-foreground rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Delete This Exam Record?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete the attempt for &quot;{attemptToDelete?.quizTitle}&quot; ({attemptToDelete?.score}/{attemptToDelete?.total})? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs rounded-lg border-border bg-transparent hover:bg-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (attemptToDelete) {
                  deleteHistoryAttempt(attemptToDelete.id);
                  setAttemptToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium rounded-lg"
            >
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation Modal */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border text-foreground rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Clear All Examination History?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will permanently delete all {history.length} logged exam attempts from this device and the cloud.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs rounded-lg border-border bg-transparent hover:bg-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearHistory();
                setShowClearDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium rounded-lg"
            >
              Clear All Records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
