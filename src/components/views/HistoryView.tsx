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
  RefreshCw,
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
    isSyncing,
    syncLibraryWithCloud,
    lastSyncTime,
    activeExamSession,
    resumeActiveExam,
    discardActiveExam,
  } = useQuiz();

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [attemptToDelete, setAttemptToDelete] = useState<QuizAttempt | null>(null);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-20 space-y-6">
      
      {/* Header */}
      <div className="border-b border-border/80 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs py-0.5 px-2 text-primary border-primary/30">
              Quiz History
            </Badge>
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
          {user && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSyncing}
              onClick={() => syncLibraryWithCloud(false)}
              className="h-8 text-xs gap-1.5 border-border/70 shrink-0"
              title="Sync history with cloud"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 text-primary', isSyncing && 'animate-spin')} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </Button>
          )}

          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClearDialog(true)}
              className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </Button>
          )}
        </div>
      </div>

      {/* Unsubmitted Active Test (Displayed on History page when any test is unsubmitted) */}
      {activeExamSession && (
        <div className="rounded-xl border border-emerald-500/40 bg-card p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in transition-all relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pt-1">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] px-2 py-0.5 font-medium">
                  Unsubmitted Quiz (In Progress)
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  Question {(activeExamSession.currentQuestionIndex || 0) + 1} of {activeExamSession.quiz.questions.length}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                {activeExamSession.quiz.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  Answered <strong>{Object.keys(activeExamSession.userAnswers || {}).length}</strong> of {activeExamSession.quiz.questions.length} questions
                </span>
                <span>•</span>
                <span>
                  Progress: {Math.round((Object.keys(activeExamSession.userAnswers || {}).length / activeExamSession.quiz.questions.length) * 100)}%
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
                className="h-8 text-xs text-muted-foreground hover:text-rose-500 hover:border-rose-500/40"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={resumeActiveExam}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 px-4 shadow-sm"
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
          <div className="py-16 text-center rounded-xl border border-dashed border-border/70 p-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
              <HistoryIcon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No completed quiz attempts yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Take a practice quiz or start one from your Library to see your scores and feedback here.
            </p>
            <Button size="sm" onClick={() => setView('home')} className="h-8 text-xs font-medium">
              Create a Quiz
            </Button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {activeExamSession && (
            <div className="text-xs font-semibold text-muted-foreground pt-1">
              Completed Quiz History ({history.length})
            </div>
          )}
          {history.map((attempt) => {
            const pct = Math.round((attempt.score / attempt.total) * 100);
            const isHigh = pct >= 80;
            const isMedium = pct >= 50 && pct < 80;

            return (
              <div
                key={attempt.id}
                className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-primary/40 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                {/* Left: Score Badge & Attempt Details */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Score Pill / Badge */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border font-mono font-bold transition-transform group-hover:scale-105',
                      isHigh
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                        : isMedium
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                    )}
                  >
                    <span className="text-sm leading-none">{pct}%</span>
                    <span className="text-[9px] font-normal uppercase opacity-75 mt-0.5">
                      {attempt.score}/{attempt.total}
                    </span>
                  </div>

                  {/* Information */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        onClick={() => viewAttemptResult(attempt)}
                        className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors cursor-pointer truncate"
                      >
                        {attempt.quizTitle}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="text-[10px] py-0 px-1.5 font-normal shrink-0"
                      >
                        {attempt.mode === 'Instant' ? 'Instant Mode' : 'Standard'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground/70" />
                        {new Date(attempt.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground/70" />
                        {attempt.timeSpent}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions (Review + Delete) */}
                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => viewAttemptResult(attempt)}
                    className="h-8 text-xs font-medium gap-1.5 px-3 border-border/80 hover:border-primary/40 hover:bg-primary/5 hover:text-primary flex-1 sm:flex-initial"
                  >
                    <span>Review Answers</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAttemptToDelete(attempt)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 shrink-0"
                    title="Delete this attempt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single Attempt Delete Confirmation Modal */}
      <AlertDialog open={!!attemptToDelete} onOpenChange={(open) => !open && setAttemptToDelete(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border text-foreground rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Delete This Exam Record?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete the attempt for &quot;{attemptToDelete?.quizTitle}&quot; ({attemptToDelete?.score}/{attemptToDelete?.total})? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (attemptToDelete) {
                  deleteHistoryAttempt(attemptToDelete.id);
                  setAttemptToDelete(null);
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
            >
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation Modal */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border text-foreground rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Clear All Examination History?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will permanently delete all {history.length} logged exam attempts from this device and the cloud.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearHistory();
                setShowClearDialog(false);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
            >
              Clear All Records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
