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
  Wand2,
  FileCode2,
  Play,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Zap,
  Key,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import type { Quiz } from '@/lib/types';

const STORAGE_API_KEY = 'mcqhub_gemini_api_key';

export function HomeView() {
  const { startQuiz, saveQuizToLibrary, setView, setEditorJsonBuffer, addToast } = useQuiz();

  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [quizStyle, setQuizStyle] = useState<'General' | 'Conceptual' | 'Problem Solving'>('General');
  const [context, setContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [instantMode, setInstantMode] = useState(false);
  const [withExplanations, setWithExplanations] = useState(true);

  // Gemini API Key state
  const [customApiKey, setCustomApiKey] = useState('');
  const [showApiKeyConfig, setShowApiKeyConfig] = useState(false);
  const [apiErrorNotice, setApiErrorNotice] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem(STORAGE_API_KEY);
      if (storedKey) setCustomApiKey(storedKey);
    } catch {}
  }, []);

  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    try {
      if (key.trim()) {
        localStorage.setItem(STORAGE_API_KEY, key.trim());
        addToast('Gemini API key saved to local session', 'success');
      } else {
        localStorage.removeItem(STORAGE_API_KEY);
      }
    } catch {}
    setApiErrorNotice(null);
  };

  const topicPresets = [
    'Calculus & Derivatives',
    'Quantum Mechanics',
    'Operating Systems & Concurrency',
    'Data Structures & Algorithms',
    'Organic Chemistry',
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      addToast('Please enter a topic', 'info');
      return;
    }

    setIsGenerating(true);
    setGeneratedQuiz(null);
    setApiErrorNotice(null);

    try {
      const res = await generateQuizAction({
        topic: topic.trim(),
        questionCount,
        difficulty,
        quizStyle,
        context: context.trim() || undefined,
        withExplanations,
        customApiKey: customApiKey.trim() || undefined,
      });

      if (!res.success || !res.data) {
        const errorMsg = res.error || 'Failed to generate quiz';
        if (
          errorMsg.toLowerCase().includes('api key') ||
          errorMsg.toLowerCase().includes('leaked') ||
          errorMsg.toLowerCase().includes('permission_denied')
        ) {
          setShowApiKeyConfig(true);
          setApiErrorNotice(errorMsg);
        }
        addToast(errorMsg, 'error');
        return;
      }

      const newQuiz: Quiz = {
        title: res.data.title,
        questions: res.data.questions,
        createdAt: new Date().toISOString(),
      };

      setGeneratedQuiz(newQuiz);
      saveQuizToLibrary(newQuiz);
      addToast(`Generated "${newQuiz.title}" with ${newQuiz.questions.length} questions`, 'success');
    } catch (err: any) {
      addToast(err?.message || 'Error occurred during generation', 'error');
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
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-16 space-y-6">
      
      {/* Studio Header */}
      <div className="border-b border-border/80 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="font-mono text-[11px] py-0 px-1.5 text-primary border-primary/30">
            Assessment Studio
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">/ generate-quiz.ts</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Generative Assessment Engine
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
          Synthesize technical multiple-choice questions from any domain, syllabus text, or concepts. Fully typeset with LaTeX mathematics and Cloud Firestore sync.
        </p>
      </div>

      {/* Main Generator Card */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Wand2 className="w-3.5 h-3.5 text-primary" />
            <span>Generation Parameters</span>
          </div>
          <button
            type="button"
            onClick={() => setShowApiKeyConfig(!showApiKeyConfig)}
            className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <Key className="w-3 h-3 text-amber-400" />
            <span>{customApiKey ? 'Custom API Key Active' : 'API Key Settings'}</span>
            {showApiKeyConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* API Key Configuration Panel */}
        {showApiKeyConfig && (
          <div className="p-3.5 border-b border-border/60 bg-muted/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Google AI Studio (Gemini) API Key</span>
              </Label>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-mono"
              >
                <span>Get free key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={customApiKey}
                onChange={(e) => handleSaveApiKey(e.target.value)}
                className="h-8 text-xs font-mono bg-background"
              />
              {customApiKey && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSaveApiKey('')}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-rose-400 font-mono"
                >
                  Clear
                </Button>
              )}
            </div>
            {apiErrorNotice && (
              <div className="p-2 rounded bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300 flex items-start gap-1.5 font-mono">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{apiErrorNotice}</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Stored securely in your local browser session. Passed directly to Google Gemini 2.5 Flash Lite.
            </p>
          </div>
        )}

        <form onSubmit={handleGenerate} className="p-4 sm:p-5 space-y-4">
          
          {/* Topic Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Assessment Topic or Chapter</span>
              <span className="text-[10px] text-muted-foreground font-normal">Required</span>
            </Label>
            <Input
              type="text"
              placeholder="e.g., Fourier Transform, Special Relativity, Database Indexing..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-9 text-xs sm:text-sm bg-background font-mono"
              required
            />

            {/* Topic Preset Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground font-mono">Suggested:</span>
              {topicPresets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setTopic(preset)}
                  className="px-2 py-0.5 rounded text-[11px] bg-muted/50 hover:bg-muted border border-border/60 text-muted-foreground hover:text-foreground transition-colors font-mono"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Reference Material / Context (Collapsible) */}
          <div className="rounded border border-border/60 bg-background/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowContext(!showContext)}
              className="w-full px-3 py-2 text-left flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="flex items-center gap-1.5 font-mono">
                <span>Reference Context / Syllabus Excerpt</span>
                {context && <Badge variant="secondary" className="text-[10px] py-0 px-1">Added</Badge>}
              </div>
              {showContext ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showContext && (
              <div className="p-3 pt-0 border-t border-border/40">
                <Textarea
                  placeholder="Paste lecture notes, raw textbook paragraphs, syllabus objectives, or equations to anchor the generated questions..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="text-xs font-mono min-h-[90px] bg-background"
                />
              </div>
            )}
          </div>

          {/* Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            
            {/* Difficulty */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Difficulty Level</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['Easy', 'Medium', 'Hard'] as const).map((lvl) => (
                  <button
                    type="button"
                    key={lvl}
                    onClick={() => setDifficulty(lvl)}
                    className={`py-1.5 px-2 rounded text-xs font-mono transition-colors border ${
                      difficulty === lvl
                        ? 'bg-primary/10 border-primary text-primary font-semibold'
                        : 'border-border/60 hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Questions Count</Label>
              <div className="flex items-center gap-1">
                {[5, 10, 15, 20].map((cnt) => (
                  <button
                    type="button"
                    key={cnt}
                    onClick={() => setQuestionCount(cnt)}
                    className={`flex-1 py-1.5 rounded text-xs font-mono transition-colors border ${
                      questionCount === cnt
                        ? 'bg-primary/10 border-primary text-primary font-semibold'
                        : 'border-border/60 hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Assessment Style</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['General', 'Conceptual', 'Problem Solving'] as const).map((stl) => (
                  <button
                    type="button"
                    key={stl}
                    onClick={() => setQuizStyle(stl)}
                    className={`py-1.5 px-1 truncate rounded text-[11px] font-mono transition-colors border ${
                      quizStyle === stl
                        ? 'bg-primary/10 border-primary text-primary font-semibold'
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
            <div className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer" htmlFor="instant-mode">
                  Instant Feedback Mode
                </Label>
                <div className="text-[11px] text-muted-foreground">
                  Check answers per-question with immediate validation
                </div>
              </div>
              <Switch
                id="instant-mode"
                checked={instantMode}
                onCheckedChange={setInstantMode}
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer" htmlFor="with-explanations">
                  Include Explanations
                </Label>
                <div className="text-[11px] text-muted-foreground">
                  Generate step-by-step reasoning per question
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
              className="w-full h-10 text-xs sm:text-sm font-mono font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Questions & LaTeX Proofs...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Assessment ({questionCount} Questions)
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
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                  <span>{generatedQuiz.questions.length} Questions</span>
                  <span>•</span>
                  <span>{difficulty}</span>
                  <span>•</span>
                  <span>LaTeX Enabled</span>
                </div>
              </div>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-mono text-xs">
              Ready
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-500/20">
            <Button
              size="sm"
              onClick={() => startQuiz(generatedQuiz, instantMode)}
              className="h-8 text-xs font-mono font-medium bg-emerald-500 hover:bg-emerald-600 text-black px-3.5"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Launch Exam Now
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInEditor}
              className="h-8 text-xs font-mono border-border/80"
            >
              <FileCode2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Inspect & Edit JSON
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => saveQuizToLibrary(generatedQuiz)}
              className="h-8 text-xs font-mono"
            >
              <BookmarkCheck className="w-3.5 h-3.5 mr-1.5" />
              Saved to Library
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
