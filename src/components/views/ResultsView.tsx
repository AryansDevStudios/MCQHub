'use client';

import React, { useState } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { summarizeQuizResultsAction } from '@/lib/actions';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  BookmarkCheck,
  Share2,
  Loader2,
} from 'lucide-react';

export function ResultsView() {
  const {
    activeQuiz,
    userAnswers,
    questionNotes,
    history,
    retryQuiz,
    saveQuizToLibrary,
    openShareModal,
    isSharing,
    viewingAttempt,
    setView,
    addToast,
  } = useQuiz();

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // If no active quiz or viewing specific attempt, inspect attempt
  const currentAttempt = viewingAttempt || history[0];
  const currentQuiz = activeQuiz || currentAttempt?.quizData;
  const currentAnswers = (activeQuiz && !viewingAttempt) ? userAnswers : currentAttempt?.userAnswers || userAnswers || {};
  const currentNotes = (activeQuiz && !viewingAttempt) ? questionNotes : currentAttempt?.questionNotes || questionNotes || {};

  if (!currentQuiz || !currentQuiz.questions) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <h2 className="text-base font-medium text-foreground">No quiz results available.</h2>
        <p className="text-sm text-muted-foreground">Complete a quiz or select an attempt from your library.</p>
        <button
          onClick={() => setView('home')}
          className="inline-flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Return to Quiz Creator
        </button>
      </div>
    );
  }

  // Calculate scores safely
  let correctCount = 0;
  (currentQuiz.questions || []).forEach((q, idx) => {
    if (currentAnswers[idx] === q.correctAnswer) {
      correctCount++;
    }
  });

  const totalCount = currentQuiz.questions?.length || 0;
  const wrongCount = Math.max(0, totalCount - correctCount);
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  const getTierFeedback = (pct: number) => {
    if (pct === 100) return { title: 'Perfect Score', desc: 'Outstanding accuracy across every single concept.' };
    if (pct >= 80) return { title: 'Great Job', desc: 'Solid conceptual understanding with only minor mistakes.' };
    if (pct >= 50) return { title: 'Good Effort', desc: 'Good grasp of the basics. Review the highlighted explanations below.' };
    return { title: 'Keep Practicing', desc: 'Take a close look at the explanations below and try retaking the quiz.' };
  };

  const tier = getTierFeedback(percentage);

  const handleRequestAiSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const formattedAnswers: Record<string, number> = {};
      Object.entries(currentAnswers).forEach(([k, v]) => {
        formattedAnswers[k] = v;
      });

      const storedApiKey = typeof window !== 'undefined' ? localStorage.getItem('mcqhub_gemini_api_key') : null;

      const res = await summarizeQuizResultsAction({
        quizTitle: currentQuiz.title,
        score: correctCount,
        total: totalCount,
        questions: currentQuiz.questions.map((q) => ({
          question: q.question,
          correctAnswer: q.correctAnswer,
          options: q.options,
        })),
        userAnswers: formattedAnswers,
        customApiKey: storedApiKey || undefined,
      });

      if (res.success && res.data) {
        setAiSummary(res.data);
        addToast('Study advice generated successfully!', 'success');
      } else {
        addToast(res.error || 'Failed to generate study advice', 'error');
      }
    } catch (err: any) {
      addToast(err?.message || 'Error creating study advice', 'error');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
      {/* Page Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {currentQuiz.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assessment Results & Review
        </p>
      </div>

      {/* Score Card */}
      <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="flex flex-col items-start">
          <div className="text-5xl font-bold font-mono tracking-tight text-foreground">
            {correctCount} / {totalCount}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {percentage}% Correct
          </div>
          <div className="text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1 mt-3 inline-block">
            {tier.title}
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {tier.desc}
          </p>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-4 pt-5 border-t border-border mt-5">
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium block">
              Correct
            </span>
            <span className="text-sm font-semibold text-foreground mt-1 block font-mono">
              {correctCount}
            </span>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium block">
              Mistakes
            </span>
            <span className="text-sm font-semibold text-foreground mt-1 block font-mono">
              {wrongCount}
            </span>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium block">
              Time Spent
            </span>
            <span className="text-sm font-semibold text-foreground mt-1 block font-mono">
              {currentAttempt?.timeSpent || 'Finished'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => retryQuiz(currentQuiz)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retake Quiz</span>
        </button>

        <button
          onClick={() => saveQuizToLibrary(currentQuiz)}
          className="inline-flex items-center gap-2 border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <BookmarkCheck className="w-4 h-4" />
          <span>Save to Library</span>
        </button>

        <button
          disabled={isSharing}
          onClick={() => openShareModal(currentQuiz)}
          className="inline-flex items-center gap-2 border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          <span>{isSharing ? 'Sharing...' : 'Share'}</span>
        </button>
      </div>

      {/* AI Summary Section */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Personalized Study Tips</span>
          </div>

          {!aiSummary && !isGeneratingSummary && (
            <button
              onClick={handleRequestAiSummary}
              className="text-sm text-primary hover:underline font-medium"
            >
              Generate Study Advice
            </button>
          )}
        </div>

        {isGeneratingSummary && (
          <div className="animate-pulse text-sm text-muted-foreground flex items-center gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Analyzing your answers and generating study recommendations...</span>
          </div>
        )}

        {aiSummary && (
          <div className="pt-2 border-t border-border">
            <div className="text-sm text-muted-foreground leading-relaxed">
              <MarkdownRenderer content={aiSummary} />
            </div>
          </div>
        )}

        {!aiSummary && !isGeneratingSummary && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Analyze your answers with AI to discover knowledge gaps and focus areas.
          </p>
        )}
      </div>

      {/* Question Review Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Question Review
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            {totalCount} Questions
          </span>
        </div>

        <div className="space-y-3">
          {currentQuiz.questions.map((q, idx) => {
            const userChoice = currentAnswers[idx];
            const isCorrect = userChoice === q.correctAnswer;
            const note = currentNotes[idx];

            return (
              <div
                key={idx}
                className={`bg-card border border-border rounded-xl p-4 space-y-2 transition-colors ${
                  isCorrect
                    ? 'border-l-4 border-l-primary/60'
                    : 'border-l-4 border-l-destructive/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-mono text-muted-foreground block">
                      Question {idx + 1}
                    </span>
                    <div className="text-sm font-medium text-foreground">
                      <MarkdownRenderer content={q.question} />
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {isCorrect ? (
                      <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span>Correct</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span>Incorrect</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Answers Row */}
                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium">Your answer:</span>
                    <span className={isCorrect ? 'text-foreground' : 'text-destructive'}>
                      {userChoice !== undefined && q.options && q.options[userChoice] !== undefined ? (
                        <MarkdownRenderer content={q.options[userChoice]} inline />
                      ) : (
                        <span className="italic">{userChoice !== undefined ? `Option ${userChoice + 1}` : 'Skipped'}</span>
                      )}
                    </span>
                  </div>

                  {!isCorrect && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-foreground">Correct answer:</span>
                      <span className="text-primary font-medium">
                        {q.options && q.options[q.correctAnswer] !== undefined ? (
                          <MarkdownRenderer content={q.options[q.correctAnswer]} inline />
                        ) : (
                          <span>Option {q.correctAnswer + 1}</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="mt-2 pt-2 border-t border-border/60 text-xs text-muted-foreground space-y-1">
                    <span className="font-medium text-foreground">Explanation:</span>
                    <div className="leading-relaxed">
                      <MarkdownRenderer content={q.explanation} />
                    </div>
                  </div>
                )}

                {/* User Note */}
                {note && (
                  <div className="mt-2 p-2 rounded-lg bg-secondary text-xs text-foreground space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">
                      Your Note
                    </span>
                    <p>{note}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
