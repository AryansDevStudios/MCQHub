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
  Database,
  Calendar,
  Layers,
} from 'lucide-react';
import type { Quiz } from '@/lib/types';

export function LibraryView() {
  const {
    savedQuizzes,
    startQuiz,
    deleteQuizFromLibrary,
    setEditorJsonBuffer,
    setView,
    user,
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
            <Badge variant="outline" className="font-mono text-[11px] py-0 px-1.5 text-primary border-primary/30">
              Firestore Repository
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">/ users/{user?.username || 'me'}/quizzes</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Saved Assessments Library
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {user
              ? `Synced with Google Cloud Firestore for @${user.username}`
              : 'Stored in local browser storage (Sign in to sync with Cloud Firestore)'}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search saved quizzes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-background font-mono"
          />
        </div>
      </div>

      {/* Quizzes Grid */}
      {filteredQuizzes.length === 0 ? (
        <div className="py-16 text-center rounded-lg border border-dashed border-border/70 p-6 space-y-3">
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
            <BookmarkCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {searchQuery ? 'No matching assessments found' : 'No assessments in your library yet'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? 'Try adjusting your search query keyword.'
              : 'Generate an assessment with AI or import questions through the JSON Studio.'}
          </p>
          {!searchQuery && (
            <Button size="sm" onClick={() => setView('home')} className="h-8 text-xs font-mono">
              Generate New Assessment
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

                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-2">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-primary" /> Multiple Choice
                  </span>
                  {quiz.createdAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(quiz.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => startQuiz(quiz)}
                    className="h-7 text-xs font-mono bg-primary text-primary-foreground gap-1 px-2.5"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Launch</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditJson(quiz)}
                    className="h-7 text-xs font-mono border-border/60 gap-1 px-2.5"
                    title="Inspect & Edit in JSON Studio"
                  >
                    <FileCode2 className="w-3 h-3 text-primary" />
                    <span>JSON</span>
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuizToDelete(quiz)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-950/20"
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
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Delete Assessment from Library?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete &quot;{quizToDelete?.title}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-mono">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (quizToDelete) {
                  deleteQuizFromLibrary(quizToDelete.title);
                  setQuizToDelete(null);
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
