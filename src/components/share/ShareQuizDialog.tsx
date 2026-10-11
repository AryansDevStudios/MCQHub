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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, Check, ExternalLink, Users, Sparkles } from 'lucide-react';
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border text-foreground rounded-xl shadow-xl p-5 sm:p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Share Assessment</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Anyone can open this test on mobile or laptop, signed in or as guest.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quiz Summary Card */}
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground truncate">
                {activeShareData.quiz.title}
              </h4>
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] shrink-0 font-mono">
                {activeShareData.quiz.questions.length} Questions
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {(activeShareData.quiz.originalCreator || activeShareData.quiz.createdBy) && (
                <span>
                  Original Creator: <strong className="text-foreground">@{activeShareData.quiz.originalCreator || activeShareData.quiz.createdBy}</strong>
                </span>
              )}
              {activeShareData.quiz.createdAt && (
                <>
                  <span>•</span>
                  <span>Created: {new Date(activeShareData.quiz.createdAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>

          {/* Share Code (5-Digit Code) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>5-Digit Share Code</span>
              <span className="text-[11px] text-muted-foreground font-normal">Enter on any device in &quot;Open Shared&quot;</span>
            </Label>
            <div className="flex items-center gap-2">
              <div className="h-10 px-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 text-emerald-500 font-mono text-base flex items-center font-bold tracking-widest flex-1">
                {activeShareData.shareId}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="h-10 px-3.5 gap-1.5 text-xs border-border/80 shrink-0 font-medium"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </Button>
            </div>
          </div>

          {/* Share Link */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Direct Link</span>
              <span className="text-[11px] text-muted-foreground font-normal">Universal (Any device)</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={activeShareData.shareUrl}
                className="h-9 text-xs font-mono bg-background text-foreground select-all"
              />
              <Button
                size="sm"
                onClick={handleCopyLink}
                className="h-9 px-3 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 font-medium"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </div>

          {/* Shared Account Info (if signed in) */}
          {user && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Users className="w-3.5 h-3.5" />
                <span>Shared Account Access</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                If sharing this account with others, they can also sign in as <strong className="text-foreground">@{user.username}</strong> on their device to view synced progress and history.
              </p>
            </div>
          )}

          {/* Guest / Attempt info */}
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Recipients can either <span className="text-foreground font-medium">Attempt</span> the test directly (their attempt history is saved automatically), or optionally click <span className="text-foreground font-medium">Save to Library</span>.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShareModalOpen(false)}
            className="h-8 text-xs px-4"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
