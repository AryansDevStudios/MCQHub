'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import type { Quiz } from '@/lib/types';

const STORAGE_API_KEY = 'mcqhub_gemini_api_key';

export interface TopicPreset {
  title: string;
  display: string;
  grade: 'Class 10' | 'Class 9' | 'Class 8' | 'Class 11' | 'Class 12';
  subject: 'Science' | 'Social Studies' | 'Math' | 'Physics' | 'Chemistry' | 'Biology';
}

export const TOPIC_PRESETS: TopicPreset[] = [
  // Class 10 (Primary Focus - Board Curriculum)
  { title: 'Light: Reflection & Refraction (Class 10 Science)', display: 'Light: Reflection & Refraction', grade: 'Class 10', subject: 'Science' },
  { title: 'Chemical Reactions and Equations (Class 10 Science)', display: 'Chemical Reactions & Equations', grade: 'Class 10', subject: 'Science' },
  { title: 'Life Processes (Class 10 Science)', display: 'Life Processes (Nutrition & Respiration)', grade: 'Class 10', subject: 'Science' },
  { title: 'Electricity & Magnetic Effects (Class 10 Science)', display: 'Electricity & Circuits', grade: 'Class 10', subject: 'Science' },
  { title: 'Acids, Bases and Salts (Class 10 Science)', display: 'Acids, Bases & Salts', grade: 'Class 10', subject: 'Science' },
  { title: 'Nationalism in India (Class 10 SST)', display: 'Nationalism in India', grade: 'Class 10', subject: 'Social Studies' },
  { title: 'Power Sharing & Federalism (Class 10 SST)', display: 'Power Sharing & Federalism', grade: 'Class 10', subject: 'Social Studies' },
  { title: 'Resources and Development (Class 10 SST)', display: 'Resources and Development', grade: 'Class 10', subject: 'Social Studies' },
  { title: 'Sectors of the Indian Economy (Class 10 SST)', display: 'Sectors of the Economy', grade: 'Class 10', subject: 'Social Studies' },
  { title: 'Trigonometry & Applications (Class 10 Math)', display: 'Trigonometry & Heights', grade: 'Class 10', subject: 'Math' },
  { title: 'Quadratic Equations & Arithmetic Progressions (Class 10 Math)', display: 'Quadratic Equations & AP', grade: 'Class 10', subject: 'Math' },

  // Class 9
  { title: 'Matter in Our Surroundings (Class 9 Science)', display: 'Matter in Our Surroundings', grade: 'Class 9', subject: 'Science' },
  { title: 'Force and Laws of Motion (Class 9 Science)', display: 'Force & Laws of Motion', grade: 'Class 9', subject: 'Science' },
  { title: 'The French Revolution (Class 9 SST)', display: 'The French Revolution', grade: 'Class 9', subject: 'Social Studies' },

  // Class 8
  { title: 'Cell Structure and Microorganisms (Class 8 Science)', display: 'Cell Structure & Functions', grade: 'Class 8', subject: 'Science' },
  { title: 'Force and Pressure (Class 8 Science)', display: 'Force & Pressure', grade: 'Class 8', subject: 'Science' },
  { title: 'The Indian Constitution (Class 8 SST)', display: 'The Indian Constitution', grade: 'Class 8', subject: 'Social Studies' },

  // Class 11
  { title: 'Kinematics & Laws of Motion (Class 11 Physics)', display: 'Kinematics & Laws of Motion', grade: 'Class 11', subject: 'Physics' },
  { title: 'Chemical Bonding & Molecular Structure (Class 11 Chemistry)', display: 'Chemical Bonding', grade: 'Class 11', subject: 'Chemistry' },

  // Class 12
  { title: 'Electrostatics & Current Electricity (Class 12 Physics)', display: 'Electrostatics & Current', grade: 'Class 12', subject: 'Physics' },
  { title: 'Solutions & Electrochemistry (Class 12 Chemistry)', display: 'Solutions & Electrochemistry', grade: 'Class 12', subject: 'Chemistry' },
  { title: 'Genetics and Evolution (Class 12 Biology)', display: 'Genetics & Evolution', grade: 'Class 12', subject: 'Biology' },
];

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

  // Chapter ideas filter - Class 10 selected by default as primary focus
  const [presetFilter, setPresetFilter] = useState<'Class 10' | 'All' | 'Science' | 'SST' | 'Class 8-9' | 'Class 11-12'>('Class 10');

  const filteredPresets = useMemo(() => {
    if (presetFilter === 'All') return TOPIC_PRESETS;
    if (presetFilter === 'Class 10') return TOPIC_PRESETS.filter((p) => p.grade === 'Class 10');
    if (presetFilter === 'Science') {
      return TOPIC_PRESETS.filter(
        (p) => p.subject === 'Science' || p.subject === 'Physics' || p.subject === 'Chemistry' || p.subject === 'Biology'
      );
    }
    if (presetFilter === 'SST') return TOPIC_PRESETS.filter((p) => p.subject === 'Social Studies');
    if (presetFilter === 'Class 8-9') return TOPIC_PRESETS.filter((p) => p.grade === 'Class 8' || p.grade === 'Class 9');
    if (presetFilter === 'Class 11-12') return TOPIC_PRESETS.filter((p) => p.grade === 'Class 11' || p.grade === 'Class 12');
    return TOPIC_PRESETS;
  }, [presetFilter]);

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
      
      {/* Unsubmitted Active Test (Prominently displayed at the very beginning of the front panel) */}
      {activeExamSession && (
        <div className="rounded-xl border border-primary/40 bg-card p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in transition-all">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <Badge className="bg-primary/15 text-primary border border-primary/30 text-[10px] px-2 py-0.5 font-medium">
                  Unsubmitted Test
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  Question {(activeExamSession.currentQuestionIndex || 0) + 1} of {activeExamSession.quiz.questions.length}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                {activeExamSession.quiz.title}
              </h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  Answered <strong>{Object.keys(activeExamSession.userAnswers || {}).length}</strong> of {activeExamSession.quiz.questions.length} questions
                </span>
                <span>•</span>
                <span>
                  Progress: {Math.round((Object.keys(activeExamSession.userAnswers || {}).length / activeExamSession.quiz.questions.length) * 100)}%
                </span>
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
                className="h-8 text-xs bg-primary text-primary-foreground font-semibold gap-1.5 px-4 shadow-sm"
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
              <span>Topic or Chapter</span>
              <span className="text-[11px] text-muted-foreground font-normal">Required</span>
            </Label>
            <Input
              type="text"
              placeholder="e.g., Light: Reflection & Refraction (Class 10), Life Processes, Nationalism in India..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-9 text-xs sm:text-sm bg-background"
              required
            />

            {/* Chapter Ideas & Category Filter */}
            <div className="space-y-2 pt-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Chapter Ideas ({filteredPresets.length}):</span>
                </div>
                
                {/* Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {(['Class 10', 'All', 'Science', 'SST', 'Class 8-9', 'Class 11-12'] as const).map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setPresetFilter(cat)}
                      className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium transition-all ${
                        presetFilter === cat
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50'
                      }`}
                    >
                      {cat === 'Class 10' ? 'Class 10 ⭐' : cat === 'SST' ? 'SST' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset Chips */}
              <div className="flex flex-wrap items-center gap-1.5 max-h-40 overflow-y-auto pr-1 py-0.5">
                {filteredPresets.map((preset) => {
                  const isSelected = topic === preset.title;
                  return (
                    <button
                      type="button"
                      key={preset.title}
                      onClick={() => setTopic(preset.title)}
                      className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-all text-left ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary font-medium shadow-xs'
                          : 'bg-muted/30 hover:bg-muted/80 border-border/70 text-foreground/80 hover:text-foreground'
                      }`}
                    >
                      <span>{preset.display}</span>
                      <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-medium ${
                        preset.grade === 'Class 10'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {preset.grade.replace('Class ', '')}th {preset.subject === 'Social Studies' ? 'SST' : preset.subject}
                      </span>
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
