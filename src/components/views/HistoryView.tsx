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
  CheckCircle2,
  XCircle,
  RefreshCw,
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
              Exam History
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Past Quiz Attempts
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {user ? (
              <span>
                Saved and synced with Cloud Firestore for <strong className="text-foreground">@{user.username}</strong>
                {lastSyncTime && (
                  <span className="text-[11px] opacity-75 font-mono ml-2">
                    (Aligned: {new Date(lastSyncTime).toLocaleTimeString()})
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
              className="h-8 text-xs font-mono gap-1.5 border-border/70 shrink-0"
              title="Align history logs with Cloud Firestore"
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
              className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </Button>
          )}
        </div>
      </div>

      {/* Attempts List */}
      {history.length === 0 ? (
        <div className="py-16 text-center rounded-lg border border-dashed border-border/70 p-6 space-y-3">
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No quiz attempts yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Take a practice quiz or start one from your Library to see your scores and feedback here.
          </p>
          <Button size="sm" onClick={() => setView('home')} className="h-8 text-xs font-medium">
            Create a Quiz
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((attempt) => {
            const pct = Math.round((attempt.score / attempt.total) * 100);
            const isHigh = pct >= 80;
            const isMedium = pct >= 50 && pct < 80;

            return (
              <div
                key={attempt.id}
                className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Attempt info (clickable to review) */}
                <div
                  onClick={() => viewAttemptResult(attempt)}
                  className="space-y-1.5 cursor-pointer flex-1"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {attempt.quizTitle}
                    </h3>
                    <Badge variant="outline" className="text-[10px] py-0 px-1">
                      {attempt.mode} Mode
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(attempt.date).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {attempt.timeSpent}
                    </span>
                  </div>
                </div>

                {/* Score & Action Buttons */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div
                    onClick={() => viewAttemptResult(attempt)}
                    className="text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 justify-end">
                      {isHigh ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isMedium ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span className="font-bold text-sm text-foreground">
                        {attempt.score}/{attempt.total}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] font-medium ${
                        isHigh ? 'text-emerald-400' : isMedium ? 'text-amber-400' : 'text-rose-400'
                      }`}
                    >
                      {pct}%
                    </div>
                  </div>

                  {/* Individual Delete Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttemptToDelete(attempt);
                    }}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-950/20"
                    title="Delete this attempt"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>

                  {/* Review Arrow */}
                  <div
                    onClick={() => viewAttemptResult(attempt)}
                    className="cursor-pointer pl-1 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                    title="Review attempt details"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single Attempt Delete Confirmation Modal */}
      <AlertDialog open={!!attemptToDelete} onOpenChange={(open) => !open && setAttemptToDelete(null)}>
        <AlertDialogContent className="bg-card border-border text-foreground">
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
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Clear All Examination History?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will permanently delete all {history.length} logged exam attempts from local storage and Cloud Firestore.
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
