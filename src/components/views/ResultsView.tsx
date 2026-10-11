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
  ChevronRight,
  FileText,
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
        <h2 className="text-base font-semibold">No assessment results available.</h2>
        <Button onClick={() => setView('home')} size="sm">
          Return to Studio
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
    if (pct === 100) return { title: 'Flawless Mastery', desc: 'Outstanding accuracy across every single concept.' };
    if (pct >= 80) return { title: 'High Proficiency', desc: 'Solid conceptual understanding with minor edge cases.' };
    if (pct >= 50) return { title: 'Competent Progress', desc: 'Good grasp of the basics; review highlighted explanations.' };
    return { title: 'Formative Practice Needed', desc: 'Review the step-by-step proofs and retake the assessment.' };
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
        addToast('AI Diagnostic assessment synthesized', 'success');
      } else {
        addToast(res.error || 'Failed to generate diagnostic report', 'error');
      }
    } catch (err: any) {
      addToast(err?.message || 'Error creating AI summary', 'error');
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
            <Badge variant="outline" className="font-mono text-[11px] py-0 px-1.5 text-emerald-400 border-emerald-500/30">
              Diagnostic Complete
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">/ results.log</span>
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
            className="h-8 text-xs font-mono border-border/70 gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
            <span>Retake Exam</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => saveQuizToLibrary(currentQuiz)}
            className="h-8 text-xs font-mono border-border/70 gap-1.5"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>Save Quiz</span>
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
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-1">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Diagnostic Tier</span>
            </div>
            <h3 className="text-lg font-bold text-foreground">{tier.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {tier.desc}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50 text-xs font-mono">
            <div className="p-2 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Correct
              </div>
              <div className="font-bold text-sm text-foreground mt-0.5">{correctCount} / {totalCount}</div>
            </div>

            <div className="p-2 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                <XCircle className="w-3 h-3 text-rose-400" /> Mistakes
              </div>
              <div className="font-bold text-sm text-foreground mt-0.5">{wrongCount}</div>
            </div>

            <div className="p-2 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-400" /> Duration
              </div>
              <div className="font-bold text-sm text-foreground mt-0.5">
                {latestAttempt?.timeSpent || 'Complete'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* AI Diagnostic Summarizer Section */}
      <div className="rounded-lg border border-sky-500/30 bg-sky-950/15 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-semibold font-mono text-foreground uppercase tracking-wider">
              Generative Tutor Feedback
            </h3>
          </div>

          {!aiSummary && (
            <Button
              size="sm"
              disabled={isGeneratingSummary}
              onClick={handleRequestAiSummary}
              className="h-7 text-xs font-mono bg-sky-500 hover:bg-sky-600 text-black px-3"
            >
              {isGeneratingSummary ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Analyzing Exam Data...
                </>
              ) : (
                <>
                  <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
                  Synthesize Tutor Analysis
                </>
              )}
            </Button>
          )}
        </div>

        {aiSummary ? (
          <div className="text-xs sm:text-sm text-foreground leading-relaxed pt-2 border-t border-sky-500/20">
            <MarkdownRenderer content={aiSummary} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Activate the AI diagnostic engine to evaluate your specific answer patterns and get targeted topic recommendations.
          </p>
        )}
      </div>

      {/* Detailed Question Review List */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold font-mono text-foreground uppercase tracking-wider">
            Detailed Solution Breakdown
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {totalCount} Questions Evaluated
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
                    : 'border-rose-500/30 bg-rose-950/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] shrink-0 mt-0.5 ${
                        isCorrect ? 'text-emerald-400 border-emerald-500/30' : 'text-rose-400 border-rose-500/30'
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
                      <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-rose-400">
                        <XCircle className="w-3.5 h-3.5" /> Incorrect
                      </span>
                    )}
                  </div>
                </div>

                {/* Answers Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
                  <div className={`p-2.5 rounded border ${
                    isCorrect
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                  }`}>
                    <div className="text-[10px] text-muted-foreground uppercase">Your Choice:</div>
                    <div className="mt-0.5">
                      {userChoice !== undefined ? (
                        <MarkdownRenderer content={q.options[userChoice]} />
                      ) : (
                        <span className="italic opacity-60">Skipped</span>
                      )}
                    </div>
                  </div>

                  {!isCorrect && (
                    <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/40 text-emerald-200">
                      <div className="text-[10px] text-emerald-400 uppercase">Correct Solution:</div>
                      <div className="mt-0.5">
                        <MarkdownRenderer content={q.options[q.correctAnswer]} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="p-2.5 rounded bg-muted/30 border border-border/40 text-xs text-muted-foreground space-y-1">
                    <span className="font-semibold text-foreground text-[11px] font-mono">Proof & Reasoning:</span>
                    <div className="leading-relaxed text-foreground/90">
                      <MarkdownRenderer content={q.explanation} />
                    </div>
                  </div>
                )}

                {/* Notes Recall */}
                {note && (
                  <div className="p-2 rounded bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200/90 font-mono">
                    <span className="text-[10px] text-amber-400 uppercase block mb-0.5">Scratchpad Note:</span>
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
