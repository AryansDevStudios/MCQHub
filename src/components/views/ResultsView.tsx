'use client';

import React, { useState } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { summarizeQuizResultsAction } from '@/lib/actions';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Sparkles,
  BookmarkCheck,
  Loader2,
  Lightbulb,
} from 'lucide-react';

export function ResultsView() {
  const {
    activeQuiz,
    userAnswers,
    questionNotes,
    history,
    retryQuiz,
    saveQuizToLibrary,
    setView,
    addToast,
  } = useQuiz();

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // If no active quiz, look for the most recent attempt in history
  const latestAttempt = history[0];
  const currentQuiz = activeQuiz || latestAttempt?.quizData;
  const currentAnswers = activeQuiz ? userAnswers : latestAttempt?.userAnswers || {};
  const currentNotes = activeQuiz ? questionNotes : latestAttempt?.questionNotes || {};

  if (!currentQuiz || !currentQuiz.questions) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <h2 className="text-base font-semibold">No quiz results available.</h2>
        <Button onClick={() => setView('home')} size="sm">
          Return to Quiz Creator
        </Button>
      </div>
    );
  }

  // Calculate scores
  let correctCount = 0;
  currentQuiz.questions.forEach((q, idx) => {
    if (currentAnswers[idx] === q.correctAnswer) {
      correctCount++;
    }
  });

  const totalCount = currentQuiz.questions.length;
  const wrongCount = totalCount - correctCount;
  const percentage = Math.round((correctCount / totalCount) * 100);

  const chartData = [
    { name: 'Correct', value: correctCount, color: '#10b981' },
    { name: 'Incorrect', value: wrongCount, color: '#f43f5e' },
  ];

  const getTierFeedback = (pct: number) => {
    if (pct === 100) return { title: 'Perfect Score!', desc: 'Outstanding accuracy across every single concept.' };
    if (pct >= 80) return { title: 'Great Job!', desc: 'Solid conceptual understanding with only minor mistakes.' };
    if (pct >= 50) return { title: 'Good Effort!', desc: 'Good grasp of the basics. Review the highlighted explanations below.' };
    return { title: 'Keep Practicing!', desc: 'Take a close look at the explanations below and try retaking the quiz.' };
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
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-20 space-y-6">
      
      {/* Header */}
      <div className="border-b border-border/80 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs py-0.5 px-2 text-emerald-500 border-emerald-500/30">
              Quiz Completed
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {currentQuiz.title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={retryQuiz}
            className="h-8 text-xs border-border/70 gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
            <span>Retake Quiz</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => saveQuizToLibrary(currentQuiz)}
            className="h-8 text-xs border-border/70 gap-1.5"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>Save to Library</span>
          </Button>
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Donut Chart Card */}
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col items-center justify-center relative shadow-xs">
          <div className="w-36 h-36 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={60}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
              <span className="text-2xl font-bold tracking-tight text-foreground">{percentage}%</span>
              <span className="text-[10px] text-muted-foreground uppercase">Score</span>
            </div>
          </div>
        </div>

        {/* Qualitative Feedback Card */}
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Your Performance</span>
            </div>
            <h3 className="text-lg font-bold text-foreground">{tier.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {tier.desc}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50 text-xs">
            <div className="p-2 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Correct
              </div>
              <div className="font-bold text-sm text-foreground mt-0.5">{correctCount} / {totalCount}</div>
            </div>

            <div className="p-2 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                <XCircle className="w-3 h-3 text-rose-500" /> Mistakes
              </div>
              <div className="font-bold text-sm text-foreground mt-0.5">{wrongCount}</div>
            </div>

            <div className="p-2 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" /> Time Spent
              </div>
              <div className="font-bold text-sm text-foreground mt-0.5">
                {latestAttempt?.timeSpent || 'Finished'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* AI Study Advice Section */}
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Personalized Study Tips & Review
            </h3>
          </div>

          {!aiSummary && (
            <Button
              size="sm"
              disabled={isGeneratingSummary}
              onClick={handleRequestAiSummary}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-3 gap-1.5 font-medium"
            >
              {isGeneratingSummary ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing Answers...
                </>
              ) : (
                <>
                  <Lightbulb className="w-3.5 h-3.5" />
                  Get Study Advice
                </>
              )}
            </Button>
          )}
        </div>

        {aiSummary ? (
          <div className="text-xs sm:text-sm text-foreground leading-relaxed pt-2 border-t border-primary/20">
            <MarkdownRenderer content={aiSummary} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Click <strong>Get Study Advice</strong> to analyze your answers and receive personalized recommendations for concepts you should review.
          </p>
        )}
      </div>

      {/* Question Review List */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Question Review
          </h3>
          <span className="text-xs text-muted-foreground">
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
                className={`rounded-lg border p-4 space-y-3 transition-colors ${
                  isCorrect
                    ? 'border-border/70 bg-card'
                    : 'border-rose-500/25 bg-rose-500/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 mt-0.5 ${
                        isCorrect ? 'text-emerald-500 border-emerald-500/30' : 'text-rose-500 border-rose-500/30'
                      }`}
                    >
                      Q{idx + 1}
                    </Badge>
                    <div className="text-xs sm:text-sm font-medium text-foreground">
                      <MarkdownRenderer content={q.question} />
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isCorrect ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-rose-500 font-medium">
                        <XCircle className="w-3.5 h-3.5" /> Incorrect
                      </span>
                    )}
                  </div>
                </div>

                {/* Answers Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div className={`p-2.5 rounded border ${
                    isCorrect
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-foreground'
                      : 'bg-rose-500/10 border-rose-500/30 text-foreground'
                  }`}>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium">Your Choice:</div>
                    <div className="mt-0.5">
                      {userChoice !== undefined ? (
                        <MarkdownRenderer content={q.options[userChoice]} inline />
                      ) : (
                        <span className="italic text-muted-foreground">Skipped</span>
                      )}
                    </div>
                  </div>

                  {!isCorrect && (
                    <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-foreground">
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-medium">Correct Answer:</div>
                      <div className="mt-0.5">
                        <MarkdownRenderer content={q.options[q.correctAnswer]} inline />
                      </div>
                    </div>
                  )}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="p-2.5 rounded bg-muted/40 border border-border/40 text-xs text-muted-foreground space-y-1">
                    <span className="font-semibold text-foreground text-[11px]">Explanation:</span>
                    <div className="leading-relaxed text-foreground/90">
                      <MarkdownRenderer content={q.explanation} />
                    </div>
                  </div>
                )}

                {/* User Note */}
                {note && (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-foreground">
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold block mb-0.5">Your Note:</span>
                    {note}
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
