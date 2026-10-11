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
} from 'lucide-react';

export function HistoryView() {
  const { history, clearHistory, viewAttemptResult, setView, user } = useQuiz();
  const [showClearDialog, setShowClearDialog] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-20 space-y-6">
      
      {/* Header */}
      <div className="border-b border-border/80 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="font-mono text-[11px] py-0 px-1.5 text-primary border-primary/30">
              Exam Auditing
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">/ users/{user?.username || 'me'}/history</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Examination Log & Attempts
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {user
              ? `Chronological records synced with Cloud Firestore for @${user.username}`
              : 'Chronological test history recorded locally'}
          </p>
        </div>

        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClearDialog(true)}
            className="h-8 text-xs font-mono text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 gap-1.5 self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Attempt History
          </Button>
        )}
      </div>

      {/* Attempts List */}
      {history.length === 0 ? (
        <div className="py-16 text-center rounded-lg border border-dashed border-border/70 p-6 space-y-3">
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No examination history found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Take an exam in the Assessment Studio or launch one from your Library to begin recording diagnostic metrics.
          </p>
          <Button size="sm" onClick={() => setView('home')} className="h-8 text-xs font-mono">
            Launch New Exam
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
                onClick={() => viewAttemptResult(attempt)}
                className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors cursor-pointer shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {attempt.quizTitle}
                    </h3>
                    <Badge variant="outline" className="font-mono text-[10px] py-0 px-1">
                      {attempt.mode} Mode
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(attempt.date).toLocaleString()}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {attempt.timeSpent}
                    </span>
                    <span>•</span>
                    <span>
                      {attempt.score} of {attempt.total} correct
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right font-mono">
                    <Badge
                      className={
                        isHigh
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs font-bold'
                          : isMedium
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs font-bold'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30 text-xs font-bold'
                      }
                    >
                      {pct}%
                    </Badge>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Purge All Exam Attempts?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will erase all past exam attempts and diagnostic logs. This action cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-mono">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearHistory();
                setShowClearDialog(false);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono"
            >
              Purge History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
