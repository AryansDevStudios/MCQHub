'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, BookmarkCheck, Share2, UserCheck, HelpCircle } from 'lucide-react';
import { useQuiz } from '@/context/QuizProvider';

export function SharedQuizPromptDialog() {
  const {
    pendingSharedQuiz,
    acceptPendingSharedQuiz,
    dismissPendingSharedQuiz,
  } = useQuiz();

  if (!pendingSharedQuiz) return null;

  const { quiz, createdBy } = pendingSharedQuiz;

  return (
    <Dialog open={!!pendingSharedQuiz} onOpenChange={(open) => !open && dismissPendingSharedQuiz()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] bg-card border border-border text-foreground rounded-2xl shadow-xl p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 pr-6 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight truncate">
                Shared Assessment Found
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                An assessment set has been shared with you.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Quiz Details Card */}
          <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
                {quiz.title || 'Untitled Assessment'}
              </h3>
              <Badge variant="outline" className="text-xs text-primary border-border bg-background shrink-0 font-mono">
                {quiz.questions?.length ?? 0} Questions
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1.5 border-t border-border">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-primary" />
                <span>Original Creator: <strong className="text-foreground">{createdBy ? `@${createdBy}` : 'Collaborator'}</strong></span>
              </span>
              {pendingSharedQuiz.createdAt && !isNaN(new Date(pendingSharedQuiz.createdAt).getTime()) && (
                <>
                  <span>•</span>
                  <span>Created: {new Date(pendingSharedQuiz.createdAt).toLocaleDateString()}</span>
                </>
              )}
              {pendingSharedQuiz.shareId && (
                <>
                  <span>•</span>
                  <span className="font-mono font-medium text-primary">#{pendingSharedQuiz.shareId}</span>
                </>
              )}
            </div>
          </div>

          {/* Explanation Info */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <HelpCircle className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>How would you like to take this test?</span>
            </p>
            <p>
              • <strong className="text-foreground">Attempt Test:</strong> Starts the assessment immediately. Score and results are saved in your personal history without adding it to your Library.
            </p>
            <p>
              • <strong className="text-foreground">Save to Library:</strong> Saves a permanent copy to your personal collection for future study and review.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-background flex flex-col sm:flex-row gap-2 sm:justify-end items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={dismissPendingSharedQuiz}
            className="text-muted-foreground hover:text-foreground text-sm w-full sm:w-auto order-3 sm:order-1"
          >
            Dismiss
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => acceptPendingSharedQuiz(false, true)}
            className="border border-border rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground gap-1.5 w-full sm:w-auto order-2"
          >
            <BookmarkCheck className="w-4 h-4 text-primary" />
            <span>Save to Library</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => acceptPendingSharedQuiz(true, false)}
            className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 gap-1.5 w-full sm:w-auto order-1 sm:order-3"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Attempt Test Now</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
