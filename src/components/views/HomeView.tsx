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
    isHydrated,
  } = useQuiz();

  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState<number | string>(5);
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
        id: `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-6">
      
      {/* Unsubmitted Active Test Banner */}
      {isHydrated && activeExamSession && (
        <div className="rounded-xl border border-border border-l-4 border-l-primary bg-card p-5 space-y-3 shadow-sm animate-in fade-in transition-all">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium">
                  Unsubmitted Quiz (In Progress)
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Question {(activeExamSession.currentQuestionIndex || 0) + 1} of {activeExamSession.quiz.questions.length}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground leading-snug">
                {activeExamSession.quiz.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                <span>
                  Answered <strong className="text-foreground font-medium">{Object.keys(activeExamSession.userAnswers || {}).length}</strong> of {activeExamSession.quiz.questions.length} questions
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
                variant="ghost"
                onClick={discardActiveExam}
                className="text-muted-foreground hover:text-destructive text-sm h-8 px-3"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={resumeActiveExam}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-1.5 text-sm font-medium gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Test</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="border-b border-border pb-5 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create Practice Quiz
          </h1>
          {hasCustomKey && (
            <span className="text-xs text-muted-foreground">
              (Using custom API key)
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Generate multiple-choice practice questions on any topic in seconds. Formatted with math equations and diagrams.
        </p>
      </div>

      {/* Main Creator Card */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleGenerate} className="space-y-6">
          
          {/* Topic Input */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Topic</span>
              <span className="text-[11px] text-muted-foreground font-normal">Required</span>
            </Label>
            <Input
              type="text"
              placeholder="e.g., Photosynthesis, Laws of Motion, French Revolution, Trigonometry..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="bg-background border border-border rounded-xl px-4 py-3 text-sm w-full outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors h-11"
              required
            />

            {/* Study Ideas Section */}
            <div className="space-y-2 pt-1.5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={refreshIdeas}
                  className="group inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Click to randomize ideas"
                >
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-medium">Ideas</span>
                  <RefreshCw className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors ml-0.5" />
                </button>
                <span className="text-xs text-muted-foreground">Click to pick a topic</span>
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
                      className={`text-xs px-3 py-1 rounded-full cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {idea}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Context/Notes Accordion */}
          <div className="border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setShowContext(!showContext)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-between w-full py-2 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <span>Add Reference Notes or Syllabus (Optional)</span>
                {context && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                    Added
                  </Badge>
                )}
              </div>
              {showContext ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showContext && (
              <div className="pt-2">
                <Textarea
                  placeholder="Paste lecture notes, book paragraphs, or formulas to base the questions on..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="text-xs min-h-[90px] bg-background border border-border rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Config Grid (Difficulty / Count / Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-5 border-t border-border mb-6">
            
            {/* Difficulty */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                Difficulty
              </Label>
              <div className="grid grid-cols-3 gap-1">
                {(['Easy', 'Medium', 'Hard'] as const).map((lvl) => (
                  <button
                    type="button"
                    key={lvl}
                    onClick={() => setDifficulty(lvl)}
                    className={`py-1.5 px-2 text-xs rounded-md border transition-colors ${
                      difficulty === lvl
                        ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block">
                  Questions
                </Label>
                <span className="text-[10px] text-muted-foreground">Any count</span>
              </div>
              <div className="flex items-center gap-1">
                {[5, 10, 15, 20].map((cnt) => (
                  <button
                    type="button"
                    key={cnt}
                    onClick={() => setQuestionCount(cnt)}
                    className={`flex-1 py-1.5 px-2 text-xs rounded-md border transition-colors ${
                      questionCount === cnt
                        ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
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
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setQuestionCount('');
                    } else {
                      const num = parseInt(val, 10);
                      setQuestionCount(isNaN(num) ? '' : Math.min(100, Math.max(1, num)));
                    }
                  }}
                  onBlur={() => {
                    if (!questionCount || Number(questionCount) < 1) {
                      setQuestionCount(5);
                    }
                  }}
                  className="w-12 h-[30px] text-xs text-center rounded-md border border-border bg-background px-1"
                  title="Custom question count"
                />
              </div>
            </div>

            {/* Style */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                Style
              </Label>
              <div className="grid grid-cols-3 gap-1">
                {(['General', 'Conceptual', 'Problem Solving'] as const).map((stl) => (
                  <button
                    type="button"
                    key={stl}
                    onClick={() => setQuizStyle(stl)}
                    className={`py-1.5 px-1 truncate text-xs rounded-md border transition-colors ${
                      quizStyle === stl
                        ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                    title={stl}
                  >
                    {stl === 'Problem Solving' ? 'Problems' : stl}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Toggle Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 border-t border-border mb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <Label className="text-sm font-medium text-foreground cursor-pointer" htmlFor="instant-mode">
                  Instant Feedback Mode
                </Label>
                <div className="text-xs text-muted-foreground">
                  Check answers immediately per question
                </div>
              </div>
              <Switch
                id="instant-mode"
                checked={instantMode}
                onCheckedChange={setInstantMode}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <Label className="text-sm font-medium text-foreground cursor-pointer" htmlFor="with-explanations">
                  Include Explanations
                </Label>
                <div className="text-xs text-muted-foreground">
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

          {/* Generate Button */}
          <div>
            <Button
              type="submit"
              disabled={isGenerating}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium transition-colors"
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

      {/* Quiz Ready Banner */}
      {generatedQuiz && (
        <div className="mt-5 border border-border bg-card rounded-xl p-5 border-l-4 border-l-primary space-y-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
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
            <Badge variant="outline" className="text-xs text-primary bg-primary/10 border-primary/20 rounded-full px-2.5 py-0.5">
              Ready
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-border">
            <Button
              size="sm"
              onClick={() => startQuiz(generatedQuiz, instantMode)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-1.5 text-sm font-medium"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Start Quiz Now
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={isSharing}
              onClick={() => openShareModal(generatedQuiz)}
              className="text-sm text-muted-foreground hover:text-foreground h-8"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              {isSharing ? 'Sharing...' : 'Share Quiz'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInEditor}
              className="text-sm text-muted-foreground hover:text-foreground h-8"
            >
              <FileCode2 className="w-3.5 h-3.5 mr-1.5" />
              Edit in JSON Studio
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('library')}
              className="text-sm text-muted-foreground hover:text-foreground h-8"
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
