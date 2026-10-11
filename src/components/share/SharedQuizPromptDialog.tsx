'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border text-foreground rounded-xl shadow-2xl p-5 sm:p-6 animate-in fade-in zoom-in-95">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Shared Assessment Found
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                An assessment set has been shared with you.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quiz Details Card */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                {quiz.title}
              </h3>
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] shrink-0 font-mono">
                {quiz.questions.length} Questions
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-primary" />
                <span>Original Creator: <strong>{createdBy ? `@${createdBy}` : 'Collaborator'}</strong></span>
              </span>
              {pendingSharedQuiz.createdAt && (
                <>
                  <span>•</span>
                  <span>Created: {new Date(pendingSharedQuiz.createdAt).toLocaleDateString()}</span>
                </>
              )}
              {pendingSharedQuiz.shareId && (
                <>
                  <span>•</span>
                  <span className="font-mono font-bold text-emerald-500">#{pendingSharedQuiz.shareId}</span>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1 leading-relaxed">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <HelpCircle className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>How would you like to take this test?</span>
            </p>
            <p>
              • <strong>Attempt Test:</strong> Starts the exam immediately. When finished, your score and answers will be saved in your history and database without cluttering your Library.
            </p>
            <p>
              • <strong>Save to Library:</strong> Saves a permanent copy to your personal collection for future practice.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={dismissPendingSharedQuiz}
            className="h-8 text-xs order-3 sm:order-1"
          >
            Dismiss
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => acceptPendingSharedQuiz(false, true)}
            className="h-8 text-xs gap-1.5 border-border/80 hover:bg-muted order-2"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
            <span>Save to Library</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => acceptPendingSharedQuiz(true, false)}
            className="h-8 text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold order-1 sm:order-3 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Attempt Test Now</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
