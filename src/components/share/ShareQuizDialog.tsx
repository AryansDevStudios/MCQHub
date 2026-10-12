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
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, Check, Users } from 'lucide-react';
import { useQuiz } from '@/context/QuizProvider';

export function ShareQuizDialog() {
  const { shareModalOpen, setShareModalOpen, activeShareData, user, addToast } = useQuiz();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!activeShareData) return null;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(activeShareData.shareUrl);
      setCopiedLink(true);
      addToast('Share link copied to clipboard', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(activeShareData.shareId);
      setCopiedCode(true);
      addToast('Share Code copied: ' + activeShareData.shareId, 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] bg-card border border-border text-foreground rounded-2xl shadow-xl p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 pr-6 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight truncate">
                Share Assessment
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                Anyone can open this test on mobile or laptop, signed in or as guest.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="px-5 sm:px-6 py-5 space-y-4 sm:space-y-5 overflow-y-auto min-w-0 flex-1">
          {/* Quiz Summary Card */}
          <div className="rounded-xl border border-border bg-secondary/50 p-3.5 sm:p-4 space-y-2 min-w-0">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <h4 className="text-sm font-semibold text-foreground truncate min-w-0 flex-1" title={activeShareData.quiz.title || 'Untitled Assessment'}>
                {activeShareData.quiz.title || 'Untitled Assessment'}
              </h4>
              <Badge variant="outline" className="text-xs text-primary border-border bg-background shrink-0 font-mono">
                {activeShareData.quiz.questions?.length ?? 0} Questions
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground min-w-0">
              {(activeShareData.quiz.originalCreator || activeShareData.quiz.createdBy) && (
                <span className="truncate max-w-[220px]">
                  Original Creator: <strong className="text-foreground">@{activeShareData.quiz.originalCreator || activeShareData.quiz.createdBy}</strong>
                </span>
              )}
              {activeShareData.quiz.createdAt && !isNaN(new Date(activeShareData.quiz.createdAt).getTime()) && (
                <>
                  <span>•</span>
                  <span>Created: {new Date(activeShareData.quiz.createdAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>

          {/* Share Code (5-Digit Code) */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2 text-xs flex-wrap min-w-0">
              <span className="font-medium text-foreground">5-Digit Share Code</span>
              <span className="text-muted-foreground text-[11px] sm:text-xs">Enter on any device in &quot;Open Shared&quot;</span>
            </div>
            <div className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground bg-secondary rounded-xl py-3.5 text-center select-all border border-border">
              {activeShareData.shareId}
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="border border-border rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground gap-1.5"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </Button>
            </div>
          </div>

          {/* Share Link */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2 text-xs flex-wrap min-w-0">
              <span className="font-medium text-foreground">Direct Link</span>
              <span className="text-muted-foreground text-[11px] sm:text-xs">Universal (Any device)</span>
            </div>
            <div className="font-mono text-xs text-muted-foreground bg-secondary rounded-xl px-3 py-2.5 break-all select-all border border-border">
              {activeShareData.shareUrl}
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="border border-border rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </Button>
            </div>
          </div>

          {/* Shared Account Info (if signed in) */}
          {user && (
            <div className="rounded-xl border border-border bg-secondary/50 p-3.5 space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Users className="w-3.5 h-3.5" />
                <span>Shared Account Access</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If sharing this account with others, they can also sign in as <strong className="text-foreground">@{user.username}</strong> on their device to view synced progress and history.
              </p>
            </div>
          )}

          {/* Guest / Attempt info */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            Recipients can either <span className="text-foreground font-medium">Attempt</span> the test directly (their attempt history is saved automatically), or optionally click <span className="text-foreground font-medium">Save to Library</span>.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-t border-border flex justify-end bg-card shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShareModalOpen(false)}
            className="border border-border rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
