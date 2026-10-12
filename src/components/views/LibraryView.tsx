'use client';

import React, { useState } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { Button } from '@/components/ui/button';
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
  BookmarkCheck,
  Play,
  FileCode2,
  Trash2,
  Search,
  Calendar,
  Layers,
  RefreshCw,
  Share2,
  KeyRound,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Quiz } from '@/lib/types';

export function LibraryView() {
  const {
    savedQuizzes,
    startQuiz,
    deleteQuizFromLibrary,
    setEditorJsonBuffer,
    setView,
    user,
    isSyncing,
    syncLibraryWithCloud,
    lastSyncTime,
    openShareModal,
    setJoinModalOpen,
  } = useQuiz();

  const [searchQuery, setSearchQuery] = useState('');
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);

  const filteredQuizzes = (savedQuizzes || [])
    .filter((q): q is Quiz => !!q && typeof q === 'object')
    .filter((q) =>
      (q.title || 'Untitled Quiz').toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleEditJson = (quiz: Quiz) => {
    setEditorJsonBuffer(JSON.stringify(quiz, null, 2));
    setView('editor');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Saved Quizzes
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {user ? (
              <span>
                Synced to your account (<strong className="font-medium text-foreground">@{user.username}</strong>)
                {lastSyncTime && (
                  <span className="text-xs font-mono ml-2 text-muted-foreground">
                    • Last synced {new Date(lastSyncTime).toLocaleTimeString()}
                  </span>
                )}
              </span>
            ) : (
              'Saved locally on this device. Sign in to sync across all your devices.'
            )}
          </p>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setJoinModalOpen(true)}
            className="h-9 text-xs gap-1.5 border border-border bg-transparent hover:bg-secondary text-foreground rounded-lg shrink-0"
            title="Open test with share code or link"
          >
            <KeyRound className="w-3.5 h-3.5 text-primary" />
            <span>Open Shared</span>
          </Button>

          {user && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSyncing}
              onClick={() => syncLibraryWithCloud(false)}
              className="h-9 text-xs gap-1.5 border border-border bg-transparent hover:bg-secondary text-foreground rounded-lg shrink-0"
              title="Sync quizzes with cloud"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 text-primary', isSyncing && 'animate-spin')} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </Button>
          )}

          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search quizzes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-primary/50 w-full sm:w-56 text-foreground placeholder:text-muted-foreground transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Quizzes Grid or Empty State */}
      {filteredQuizzes.length === 0 ? (
        <div className="py-20 text-center space-y-3 border border-dashed border-border rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
            <BookmarkCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-medium text-foreground">
            {searchQuery ? 'No matching quizzes found' : 'No quizzes in your library yet'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? 'Try searching with a different keyword.'
              : 'Create a new quiz with AI or import questions using Custom JSON.'}
          </p>
          {!searchQuery && (
            <div className="pt-2">
              <Button
                size="sm"
                onClick={() => setView('home')}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-medium px-4 h-8"
              >
                Create New Quiz
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredQuizzes.map((quiz, idx) => (
            <div
              key={quiz.id || idx}
              className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:border-border/70 hover:shadow-sm transition-all"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                    {quiz.title || 'Untitled Quiz'}
                  </h3>
                  <span className="font-mono text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5 shrink-0">
                    {quiz.questions?.length ?? 0} Qs
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-primary" /> Practice Quiz
                  </span>
                  {quiz.createdAt && !isNaN(new Date(quiz.createdAt).getTime()) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(quiz.createdAt).toLocaleDateString()}
                    </span>
                  )}
                  {(quiz.originalCreator || quiz.createdBy) && (
                    <span className="flex items-center gap-1 font-medium" title="Original Creator">
                      <User className="w-3.5 h-3.5 text-primary" />
                      @{quiz.originalCreator || quiz.createdBy}
                    </span>
                  )}
                  {quiz.shareId && (
                    <span className="font-mono text-xs text-primary" title={`Share code: ${quiz.shareId}`}>
                      #{quiz.shareId}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startQuiz(quiz)}
                    className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Start</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEditJson(quiz)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary"
                    title="View or Edit JSON"
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openShareModal(quiz)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary"
                    title={quiz.shareId ? `Shared Assessment (Code: ${quiz.shareId})` : "Share Assessment"}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{quiz.shareId ? `#${quiz.shareId}` : 'Share'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setQuizToDelete(quiz)}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-auto p-1.5 rounded-lg hover:bg-secondary"
                  title="Delete Quiz"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!quizToDelete} onOpenChange={(open) => !open && setQuizToDelete(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border border-border text-foreground rounded-2xl p-6 shadow-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">
              Delete Quiz from Library?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground mt-1">
              Are you sure you want to delete &quot;{quizToDelete?.title}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="border border-border bg-transparent hover:bg-secondary text-foreground rounded-lg text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (quizToDelete) {
                  deleteQuizFromLibrary(quizToDelete.id || quizToDelete.title);
                  setQuizToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-xs font-medium"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
