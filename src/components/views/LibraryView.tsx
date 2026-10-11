'use client';

import React, { useState } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  const filteredQuizzes = savedQuizzes.filter((q) =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditJson = (quiz: Quiz) => {
    setEditorJsonBuffer(JSON.stringify(quiz, null, 2));
    setView('editor');
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 pb-20 space-y-6">
      
      {/* Header */}
      <div className="border-b border-border/80 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs py-0.5 px-2 text-primary border-primary/30">
              Quiz Library
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Saved Quizzes
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
              'Saved locally on this device. Sign in to sync across all your devices.'
            )}
          </p>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setJoinModalOpen(true)}
            className="h-8 text-xs gap-1.5 border-border/70 shrink-0"
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
              className="h-8 text-xs gap-1.5 border-border/70 shrink-0"
              title="Sync quizzes with cloud"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 text-primary', isSyncing && 'animate-spin')} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </Button>
          )}

          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search saved quizzes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Quizzes Grid */}
      {filteredQuizzes.length === 0 ? (
        <div className="py-16 text-center rounded-lg border border-dashed border-border/70 p-6 space-y-3">
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
            <BookmarkCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {searchQuery ? 'No matching quizzes found' : 'No quizzes in your library yet'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? 'Try searching with a different keyword.'
              : 'Create a new quiz with AI or import questions using Custom JSON.'}
          </p>
          {!searchQuery && (
            <Button size="sm" onClick={() => setView('home')} className="h-8 text-xs">
              Create New Quiz
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuizzes.map((quiz, idx) => (
            <div
              key={quiz.id || idx}
              className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-border/90 transition-colors shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                    {quiz.title}
                  </h3>
                  <Badge variant="secondary" className="font-mono text-[10px] shrink-0 py-0">
                    {quiz.questions.length} Qs
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-primary" /> Practice Quiz
                  </span>
                  {quiz.createdAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(quiz.createdAt).toLocaleDateString()}
                    </span>
                  )}
                  {(quiz.originalCreator || quiz.createdBy) && (
                    <span className="flex items-center gap-1 text-emerald-400/90 font-medium" title="Original Creator">
                      <User className="w-3 h-3 text-emerald-400" />
                      @{quiz.originalCreator || quiz.createdBy}
                    </span>
                  )}
                  {quiz.shareId && (
                    <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10 px-1.5 py-0">
                      Code: {quiz.shareId}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => startQuiz(quiz)}
                    className="h-7 text-xs bg-primary text-primary-foreground gap-1 px-3 font-medium"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Start Quiz</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditJson(quiz)}
                    className="h-7 text-xs border-border/60 gap-1 px-2.5"
                    title="View or Edit JSON"
                  >
                    <FileCode2 className="w-3 h-3 text-primary" />
                    <span>JSON</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openShareModal(quiz)}
                    className="h-7 text-xs border-border/60 gap-1 px-2.5 text-sky-400 hover:text-sky-300 hover:border-sky-500/40"
                    title={quiz.shareId ? `Shared Assessment (Code: ${quiz.shareId})` : "Share Assessment"}
                  >
                    <Share2 className="w-3 h-3 text-sky-400" />
                    <span>{quiz.shareId ? `#${quiz.shareId}` : 'Share'}</span>
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuizToDelete(quiz)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                  title="Delete Quiz"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!quizToDelete} onOpenChange={(open) => !open && setQuizToDelete(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md bg-card border-border text-foreground rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Delete Quiz from Library?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete &quot;{quizToDelete?.title}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (quizToDelete) {
                  deleteQuizFromLibrary(quizToDelete.id || quizToDelete.title);
                  setQuizToDelete(null);
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
