'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { useQuiz } from '@/context/QuizProvider';

export function JoinQuizDialog() {
  const { joinModalOpen, setJoinModalOpen, openSharedQuizById, isLoadingSharedQuiz } = useQuiz();
  const [codeOrUrl, setCodeOrUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeOrUrl.trim()) return;
    const ok = await openSharedQuizById(codeOrUrl);
    if (ok) {
      setCodeOrUrl('');
    }
  };

  return (
    <Dialog open={joinModalOpen} onOpenChange={setJoinModalOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border border-border text-foreground rounded-2xl shadow-xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                Open Shared Assessment
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Enter the 5-digit code or paste a direct shared assessment link.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>5-Digit Code or Direct Link</span>
              <span className="text-xs text-muted-foreground font-normal">e.g. 58291</span>
            </Label>
            <input
              type="text"
              placeholder="e.g. 58291 or paste link..."
              value={codeOrUrl}
              onChange={(e) => setCodeOrUrl(e.target.value)}
              className="bg-background border border-border rounded-xl px-3 py-3 text-base font-mono tracking-widest text-center w-full outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/50 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
              autoFocus
              required
            />
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            The assessment will open instantly. You can choose to attempt it right away or save it to your library.
          </p>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setJoinModalOpen(false)}
              className="border border-border rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoadingSharedQuiz || !codeOrUrl.trim()}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 gap-1.5"
            >
              {isLoadingSharedQuiz ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>Load Assessment</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
