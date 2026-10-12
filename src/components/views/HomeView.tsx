'use client';

import React, { useState, useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { generateQuizAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  FileCode2,
  Play,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Zap,
  Share2,
  RefreshCw,
} from 'lucide-react';
import type { Quiz } from '@/lib/types';

const STORAGE_API_KEY = 'mcqhub_gemini_api_key';

export const STUDY_IDEAS_POOL = [
  'Photosynthesis & Respiration',
  "Newton's Laws of Motion",
  'The French Revolution',
  'Trigonometry & Heights',
  'Cell Structure & Functions',
  'Chemical Reactions & Bonding',
  'Electricity & Circuits',
  'World War II',
  'Ecosystems & Biodiversity',
  'Quadratic Equations',
  'Solar System & Planets',
  'Human Circulatory System',
  'Periodic Table of Elements',
  'Plate Tectonics & Volcanoes',
  'Probability & Statistics',
  'Renaissance & Reformation',
  'Sound Waves & Acoustics',
  'Microorganisms & Immunity',
  'Calculus & Derivatives',
  'Genetics & DNA',
  'Acids, Bases & Salts',
  'Indian Independence Movement',
  'Optics & Light Reflection',
  'Thermodynamics & Heat',
];

function getRandomIdeas(count = 5): string[] {
  const shuffled = [...STUDY_IDEAS_POOL].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export function HomeView() {
  const {
    startQuiz,
    saveQuizToLibrary,
    setView,
    setEditorJsonBuffer,
    addToast,
    activeExamSession,
    resumeActiveExam,
    discardActiveExam,
    openShareModal,
    isSharing,
  } = useQuiz();

  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [quizStyle, setQuizStyle] = useState<'General' | 'Conceptual' | 'Problem Solving'>('General');
  const [context, setContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [instantMode, setInstantMode] = useState(false);
  
  // OFF by default per user instruction
  const [withExplanations, setWithExplanations] = useState(false);

  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<Quiz | null>(null);

  // Study ideas - 4 to 5 randomized options
  const [displayedIdeas, setDisplayedIdeas] = useState<string[]>(STUDY_IDEAS_POOL.slice(0, 5));

  const refreshIdeas = () => {
    setDisplayedIdeas(getRandomIdeas(5));
  };

  useEffect(() => {
    // Randomize on client mount to avoid SSR hydration differences
    setDisplayedIdeas(getRandomIdeas(5));
  }, []);

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem(STORAGE_API_KEY);
      setHasCustomKey(!!storedKey);
    } catch {}
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      addToast('Please enter a topic', 'info');
      return;
    }

    setIsGenerating(true);
    setGeneratedQuiz(null);

    const customApiKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_API_KEY) || undefined : undefined;

    try {
      const res = await generateQuizAction({
        topic: topic.trim(),
        questionCount: Number(questionCount) || 5,
        difficulty,
        quizStyle,
        context: context.trim() || undefined,
        withExplanations,
        customApiKey,
      });

      if (!res.success || !res.data) {
        addToast(res.error || 'Failed to generate quiz', 'error');
        return;
      }

      const newQuiz: Quiz = {
        title: res.data.title,
        questions: res.data.questions,
        createdAt: new Date().toISOString(),
      };

      setGeneratedQuiz(newQuiz);
      saveQuizToLibrary(newQuiz);
      addToast(`Created "${newQuiz.title}" with ${newQuiz.questions.length} questions`, 'success');
    } catch (err: any) {
      addToast(err?.message || 'Error occurred while generating quiz', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenInEditor = () => {
    if (!generatedQuiz) return;
    setEditorJsonBuffer(JSON.stringify(generatedQuiz, null, 2));
    setView('editor');
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 pb-20 space-y-6">
      
      {/* Unsubmitted Active Test (Prominently displayed in Create Practice Menu) */}
      {activeExamSession && (
        <div className="rounded-xl border border-emerald-500/40 bg-card p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in transition-all relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pt-1">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] px-2 py-0.5 font-medium">
                  Unsubmitted Quiz (In Progress)
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  Question {(activeExamSession.currentQuestionIndex || 0) + 1} of {activeExamSession.quiz.questions.length}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                {activeExamSession.quiz.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  Answered <strong>{Object.keys(activeExamSession.userAnswers || {}).length}</strong> of {activeExamSession.quiz.questions.length} questions
                </span>
                <span>•</span>
                <span>
                  Progress: {Math.round((Object.keys(activeExamSession.userAnswers || {}).length / activeExamSession.quiz.questions.length) * 100)}%
                </span>
                {activeExamSession.elapsedSeconds > 0 && (
                  <>
                    <span>•</span>
                    <span className="font-mono">
                      Elapsed: {Math.floor(activeExamSession.elapsedSeconds / 60)}m {activeExamSession.elapsedSeconds % 60}s
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Button
                size="sm"
                variant="outline"
                onClick={discardActiveExam}
                className="h-8 text-xs text-muted-foreground hover:text-rose-500 hover:border-rose-500/40"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={resumeActiveExam}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 px-4 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Test</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border/80 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs py-0.5 px-2 text-primary border-primary/30">
            Quiz Creator
          </Badge>
          {hasCustomKey && (
            <span className="text-[11px] text-muted-foreground">
              (Using custom API key)
            </span>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Create Practice Quiz
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
          Generate multiple-choice practice questions on any topic in seconds. Formatted with math equations and diagrams.
        </p>
      </div>

      {/* Main Generator Card */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <form onSubmit={handleGenerate} className="p-4 sm:p-6 space-y-5">
          
          {/* Topic Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Topic</span>
              <span className="text-[11px] text-muted-foreground font-normal">Required</span>
            </Label>
            <Input
              type="text"
              placeholder="e.g., Photosynthesis, Laws of Motion, French Revolution, Trigonometry..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-9 text-xs sm:text-sm bg-background"
              required
            />

            {/* Study Ideas Section */}
            <div className="space-y-2 pt-1.5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={refreshIdeas}
                  className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Click to randomize ideas"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-foreground/90">Ideas</span>
                  <RefreshCw className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors ml-0.5" />
                </button>
                <span className="text-[10px] text-muted-foreground">Click to pick a topic</span>
              </div>

              {/* 4 to 5 Random Study Ideas */}
              <div className="flex flex-wrap items-center gap-1.5">
                {displayedIdeas.map((idea) => {
                  const isSelected = topic === idea;
                  return (
                    <button
                      type="button"
                      key={idea}
                      onClick={() => setTopic(idea)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] border transition-all text-left ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary font-medium shadow-xs'
                          : 'bg-muted/30 hover:bg-muted/80 border-border/70 text-foreground/80 hover:text-foreground'
                      }`}
                    >
                      {idea}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reference Material / Context (Collapsible) */}
          <div className="rounded border border-border/60 bg-background/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowContext(!showContext)}
              className="w-full px-3 py-2 text-left flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <span>Add Reference Notes or Syllabus (Optional)</span>
                {context && <Badge variant="secondary" className="text-[10px] py-0 px-1">Added</Badge>}
              </div>
              {showContext ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showContext && (
              <div className="p-3 pt-0 border-t border-border/40">
                <Textarea
                  placeholder="Paste lecture notes, book paragraphs, or formulas to base the questions on..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="text-xs min-h-[90px] bg-background"
                />
              </div>
            )}
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            
            {/* Difficulty */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Difficulty</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['Easy', 'Medium', 'Hard'] as const).map((lvl) => (
                  <button
                    type="button"
                    key={lvl}
                    onClick={() => setDifficulty(lvl)}
                    className={`py-1.5 px-2 rounded text-xs transition-colors border ${
                      difficulty === lvl
                        ? 'bg-primary/15 border-primary text-primary font-semibold'
                        : 'border-border/60 hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count (No artificial limit!) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Number of Questions</span>
                <span className="text-[10px] text-muted-foreground">Any count</span>
              </Label>
              <div className="flex items-center gap-1">
                {[5, 10, 15, 20].map((cnt) => (
                  <button
                    type="button"
                    key={cnt}
                    onClick={() => setQuestionCount(cnt)}
                    className={`flex-1 py-1.5 rounded text-xs transition-colors border ${
                      questionCount === cnt
                        ? 'bg-primary/15 border-primary text-primary font-semibold'
                        : 'border-border/60 hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 5))}
                  className="w-14 h-[30px] text-xs text-center px-1 bg-background"
                  title="Custom question count"
                />
              </div>
            </div>

            {/* Style */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Style</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['General', 'Conceptual', 'Problem Solving'] as const).map((stl) => (
                  <button
                    type="button"
                    key={stl}
                    onClick={() => setQuizStyle(stl)}
                    className={`py-1.5 px-1 truncate rounded text-[11px] transition-colors border ${
                      quizStyle === stl
                        ? 'bg-primary/15 border-primary text-primary font-semibold'
                        : 'border-border/60 hover:bg-muted text-muted-foreground'
                    }`}
                    title={stl}
                  >
                    {stl === 'Problem Solving' ? 'Problems' : stl}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Behavioral Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between p-2.5 rounded bg-muted/20 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer" htmlFor="instant-mode">
                  Instant Feedback Mode
                </Label>
                <div className="text-[11px] text-muted-foreground">
                  Check answers immediately per question
                </div>
              </div>
              <Switch
                id="instant-mode"
                checked={instantMode}
                onCheckedChange={setInstantMode}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-muted/20 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer" htmlFor="with-explanations">
                  Include Explanations
                </Label>
                <div className="text-[11px] text-muted-foreground">
                  Generate answer explanations for each question
                </div>
              </div>
              <Switch
                id="with-explanations"
                checked={withExplanations}
                onCheckedChange={setWithExplanations}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isGenerating}
              className="w-full h-10 text-xs sm:text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-xs"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Quiz Questions...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Quiz ({questionCount} Questions)
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Generated Quiz Result Banner */}
      {generatedQuiz && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 sm:p-5 space-y-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  {generatedQuiz.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{generatedQuiz.questions.length} Questions</span>
                  <span>•</span>
                  <span>{difficulty}</span>
                  <span>•</span>
                  <span>Saved to Library</span>
                </div>
              </div>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
              Ready
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-500/20">
            <Button
              size="sm"
              onClick={() => startQuiz(generatedQuiz, instantMode)}
              className="h-8 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-black px-3.5"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Start Quiz Now
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={isSharing}
              onClick={() => openShareModal(generatedQuiz)}
              className="h-8 text-xs border-emerald-500/40 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-950/50"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              {isSharing ? 'Sharing...' : 'Share Quiz'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInEditor}
              className="h-8 text-xs border-border/80"
            >
              <FileCode2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Edit in JSON Studio
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('library')}
              className="h-8 text-xs"
            >
              <BookmarkCheck className="w-3.5 h-3.5 mr-1.5" />
              View in Library
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
