'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, ArrowRight, Loader2, Sparkles } from 'lucide-react';
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border text-foreground rounded-xl shadow-xl p-5 sm:p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Open Shared Assessment</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enter a Share Code or paste a direct shared assessment link.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Share Code or Link</span>
              <span className="text-[11px] text-muted-foreground font-normal">e.g. mcq_eazjivn</span>
            </Label>
            <Input
              type="text"
              placeholder="Paste link or type code here..."
              value={codeOrUrl}
              onChange={(e) => setCodeOrUrl(e.target.value)}
              className="h-9 text-xs sm:text-sm bg-background font-mono"
              autoFocus
              required
            />
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The assessment will open instantly. You can choose to attempt it right away or save it to your library.
          </p>

          <DialogFooter className="flex-row justify-end gap-2 pt-2 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setJoinModalOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoadingSharedQuiz || !codeOrUrl.trim()}
              className="h-8 text-xs bg-primary text-primary-foreground font-semibold gap-1.5 px-4 shadow-sm"
            >
              {isLoadingSharedQuiz ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>Load Test</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
