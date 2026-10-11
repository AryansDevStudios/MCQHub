'use client';

import React, { useState, useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FileCode2,
  Play,
  RotateCcw,
  Check,
  Copy,
  Code,
  FileCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { Quiz } from '@/lib/types';

const SAMPLE_QUIZ: Quiz = {
  title: 'Quantum Physics Fundamentals',
  questions: [
    {
      question: 'What is the energy of a photon given by Planck\'s relation $E = h\\nu$?',
      options: [
        'Directly proportional to its wavelength',
        'Directly proportional to its frequency $\\nu$',
        'Independent of frequency',
        'Inversely proportional to Planck\'s constant $h$',
      ],
      correctAnswer: 1,
      explanation: 'Planck\'s equation states $E = h\\nu$, where energy $E$ is directly proportional to frequency $\\nu$ scaled by Planck\'s constant $h = 6.626 \\times 10^{-34} \\text{ J}\\cdot\\text{s}$.',
    },
    {
      question: 'According to de Broglie\'s hypothesis, what is the wavelength $\\lambda$ associated with a particle of momentum $p$?',
      options: [
        '$\\lambda = \\frac{p}{h}$',
        '$\\lambda = h \\cdot p$',
        '$\\lambda = \\frac{h}{p}$',
        '$\\lambda = \\frac{h}{p^2}$',
      ],
      correctAnswer: 2,
      explanation: 'The de Broglie relation is $\\lambda = \\frac{h}{p}$, bridging particle mechanics with wave characteristics.',
    },
  ],
};

export function JsonEditorView() {
  const {
    startQuiz,
    saveQuizToLibrary,
    editorJsonBuffer,
    setEditorJsonBuffer,
    addToast,
  } = useQuiz();

  const [jsonText, setJsonText] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [instantMode, setInstantMode] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Sync buffer if available
  useEffect(() => {
    if (editorJsonBuffer) {
      setJsonText(editorJsonBuffer);
      try {
        const parsed = JSON.parse(editorJsonBuffer);
        if (parsed.title) setTitleOverride(parsed.title);
      } catch {}
    } else {
      setJsonText(JSON.stringify(SAMPLE_QUIZ, null, 2));
    }
  }, [editorJsonBuffer]);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setParseError(null);
      addToast('JSON formatted successfully', 'info');
    } catch (e: any) {
      setParseError(e.message);
      addToast('Malformed JSON syntax', 'error');
    }
  };

  const handleLoadSample = () => {
    setJsonText(JSON.stringify(SAMPLE_QUIZ, null, 2));
    setTitleOverride('');
    setParseError(null);
    addToast('Loaded physics sample structure', 'info');
  };

  const handleRun = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        setParseError('The JSON must contain a non-empty "questions" array.');
        addToast('Invalid quiz: missing questions array', 'error');
        return;
      }

      // Validate each question
      for (let i = 0; i < parsed.questions.length; i++) {
        const q = parsed.questions[i];
        if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || typeof q.correctAnswer !== 'number') {
          setParseError(`Question ${i + 1} is missing required fields (question, options array, correctAnswer index).`);
          addToast(`Question ${i + 1} validation failed`, 'error');
          return;
        }
      }

      const finalQuiz: Quiz = {
        title: titleOverride.trim() || parsed.title || 'Custom JSON Quiz',
        questions: parsed.questions,
        createdAt: new Date().toISOString(),
      };

      setParseError(null);
      saveQuizToLibrary(finalQuiz);
      startQuiz(finalQuiz, instantMode);
    } catch (e: any) {
      setParseError(e.message);
      addToast('Invalid JSON syntax: ' + e.message, 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 pb-16 space-y-6">
      
      {/* Header */}
      <div className="border-b border-border/80 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="font-mono text-[11px] py-0 px-1.5 text-primary border-primary/30">
              JSON Studio
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">/ quiz_manifest.json</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Custom Assessment Authoring
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Craft or paste custom test questions in structured JSON format with full KaTeX math support.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadSample}
            className="h-8 text-xs font-mono border-border/70"
          >
            Load Sample
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFormatJson}
            className="h-8 text-xs font-mono border-border/70"
          >
            Format JSON
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Main Code Editor Frame (3 columns) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
            {/* Editor Top Bar (Mock Window Frame) */}
            <div className="px-3 py-2 bg-muted/40 border-b border-border/60 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-muted-foreground ml-1">quiz_manifest.json</span>
              </div>
              <span className="text-[11px] text-muted-foreground">JSON Schema v2.0</span>
            </div>

            {/* Code Textarea */}
            <div className="p-1 bg-background/50">
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setParseError(null);
                }}
                spellCheck={false}
                rows={18}
                className="w-full p-3 font-mono text-xs leading-relaxed bg-transparent resize-y outline-none text-foreground select-text"
                placeholder="Paste or enter quiz JSON..."
              />
            </div>

            {/* Error Bar */}
            {parseError && (
              <div className="p-3 bg-rose-950/30 border-t border-rose-800/40 text-xs text-rose-300 font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="truncate">{parseError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Controls (1 column) */}
        <div className="space-y-4">
          
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold font-mono text-foreground uppercase tracking-wider">
              Execution Config
            </h3>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground font-mono">Title Override</Label>
              <Input
                type="text"
                placeholder="Optional custom title..."
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                className="h-8 text-xs bg-background font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label className="text-xs cursor-pointer" htmlFor="editor-instant">
                Instant Check Mode
              </Label>
              <Switch
                id="editor-instant"
                checked={instantMode}
                onCheckedChange={setInstantMode}
              />
            </div>

            <div className="pt-2">
              <Button
                onClick={handleRun}
                className="w-full h-9 text-xs font-mono font-semibold bg-primary text-primary-foreground"
              >
                <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                Validate & Launch
              </Button>
            </div>
          </div>

          {/* Schema Guide Box */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2 text-xs font-mono">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
              <span>Schema Specification</span>
            </div>
            <pre className="text-[10px] text-muted-foreground p-2 rounded bg-background border border-border/50 overflow-x-auto">
{`{
  "title": "string",
  "questions": [
    {
      "question": "Markdown / $E=mc^2$",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Optional"
    }
  ]
}`}
            </pre>
          </div>

        </div>

      </div>

    </div>
  );
}
