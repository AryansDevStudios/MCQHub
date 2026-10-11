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
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Quiz } from '@/lib/types';

const SAMPLE_QUIZ: Quiz = {
  title: 'Physics & General Science Quiz',
  questions: [
    {
      question: 'What is the energy of a photon given by Planck\'s formula $E = h\\nu$?',
      options: [
        'Directly proportional to wavelength',
        'Directly proportional to frequency $\\nu$',
        'Independent of frequency',
        'Inversely proportional to Planck\'s constant $h$',
      ],
      correctAnswer: 1,
      explanation: 'Planck\'s relation is $E = h\\nu$, meaning photon energy increases with frequency.',
    },
    {
      question: 'Is light capable of demonstrating both wave and particle characteristics?',
      options: [
        'True (Wave-particle duality)',
        'False (Only particle)',
      ],
      correctAnswer: 0,
    },
    {
      question: 'Which of the following are fundamental states of matter?',
      options: [
        'Solid',
        'Liquid',
        'Gas',
        'Plasma',
        'All of the above',
      ],
      correctAnswer: 4,
      explanation: 'Plasma is considered the fourth fundamental state of matter along with solid, liquid, and gas.',
    },
  ],
};

const AI_PROMPT_TEMPLATE = `# Instructions for AI (ChatGPT / Claude / Gemini / Any LLM):
Generate a multiple-choice quiz formatted strictly as valid JSON matching the schema below.

JSON Schema:
{
  "title": "Quiz Title or Chapter Name",
  "questions": [
    {
      "question": "Question text here. Supports Markdown formatting and LaTeX math like $E=mc^2$ or $$\\\\frac{a}{b}$$.",
      "options": [
        "First option (index 0)",
        "Second option (index 1)",
        "Third option (index 2 - supports 2 to 6 options total)",
        "Fourth option (index 3 - optional)"
      ],
      "correctAnswer": 0,
      "explanation": "Optional explanation. Can be omitted if not needed."
    }
  ]
}

Formatting Rules:
1. Each question can have anywhere from 2 to 6 options (e.g., 2 options for True/False, 4 or 5 options for standard tests).
2. "correctAnswer" MUST be the 0-based integer index of the correct choice (0 for first, 1 for second, etc.).
3. "explanation" is completely optional.
4. Use standard Markdown for bold/lists and LaTeX \`$...$\` or \`$$...$$\` for mathematical formulas.
5. Return ONLY the raw JSON object.`;

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
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showPromptGuide, setShowPromptGuide] = useState(true);

  // Sync buffer if available - keep titleOverride empty by default!
  useEffect(() => {
    if (editorJsonBuffer) {
      setJsonText(editorJsonBuffer);
      setTitleOverride('');
    } else {
      setJsonText(JSON.stringify(SAMPLE_QUIZ, null, 2));
      setTitleOverride('');
    }
  }, [editorJsonBuffer]);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setParseError(null);
      addToast('JSON formatted nicely', 'info');
    } catch (e: any) {
      setParseError(e.message);
      addToast('Invalid JSON formatting: ' + e.message, 'error');
    }
  };

  const handleLoadSample = () => {
    setJsonText(JSON.stringify(SAMPLE_QUIZ, null, 2));
    // Per instructions: title override box remains completely empty every time
    setTitleOverride('');
    setParseError(null);
    addToast('Sample questions loaded', 'info');
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
    setCopiedPrompt(true);
    addToast('AI Prompt & Schema copied to clipboard', 'success');
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleRun = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        setParseError('The JSON must contain a "questions" array with at least 1 question.');
        addToast('Invalid quiz: missing questions array', 'error');
        return;
      }

      // Validate each question
      for (let i = 0; i < parsed.questions.length; i++) {
        const q = parsed.questions[i];
        if (!q.question) {
          setParseError(`Question ${i + 1} is missing the "question" text.`);
          addToast(`Question ${i + 1} missing question text`, 'error');
          return;
        }
        if (!Array.isArray(q.options) || q.options.length < 2) {
          setParseError(`Question ${i + 1} must have an "options" list with at least 2 choices (supports 2 to 6).`);
          addToast(`Question ${i + 1} must have at least 2 options`, 'error');
          return;
        }
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
          setParseError(`Question ${i + 1} has an invalid "correctAnswer" index. Must be between 0 and ${q.options.length - 1}.`);
          addToast(`Question ${i + 1} has invalid correctAnswer index`, 'error');
          return;
        }
      }

      const finalQuiz: Quiz = {
        title: titleOverride.trim() || parsed.title || 'Custom Quiz',
        questions: parsed.questions,
        createdAt: new Date().toISOString(),
      };

      setParseError(null);
      saveQuizToLibrary(finalQuiz);
      startQuiz(finalQuiz, instantMode);
    } catch (e: any) {
      setParseError(e.message);
      addToast('Invalid JSON: ' + e.message, 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 pb-20 space-y-6">
      
      {/* Header */}
      <div className="border-b border-border/80 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs py-0.5 px-2 text-primary border-primary/30">
              Custom Quiz Studio
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Custom Quiz Studio (JSON)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Paste or write questions in JSON format. Supports 2 to 6 options, LaTeX math, and optional explanations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadSample}
            className="h-8 text-xs border-border/70"
          >
            Load Sample
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFormatJson}
            className="h-8 text-xs border-border/70"
          >
            Format JSON
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Main Code Editor Frame (3 columns) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
            {/* Editor Top Bar */}
            <div className="px-3 py-2 bg-muted/40 border-b border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-muted-foreground ml-1 text-[11px] font-medium">Question Data</span>
              </div>
              <span className="text-[11px] text-muted-foreground">JSON Editor</span>
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
                placeholder="Paste your quiz JSON here..."
              />
            </div>

            {/* Error Bar */}
            {parseError && (
              <div className="p-3 bg-rose-950/20 border-t border-rose-800/40 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="truncate">{parseError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Controls (1 column) */}
        <div className="space-y-4">
          
          <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Quiz Setup
            </h3>

            {/* Title Override (Empty every time unless edited by user) */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Title Override (Optional)</Label>
              <Input
                type="text"
                placeholder="Leave blank to use JSON title..."
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="space-y-0.5">
                <Label className="text-xs cursor-pointer" htmlFor="editor-instant">
                  Instant Feedback
                </Label>
                <div className="text-[10px] text-muted-foreground">
                  Check answers per-question
                </div>
              </div>
              <Switch
                id="editor-instant"
                checked={instantMode}
                onCheckedChange={setInstantMode}
              />
            </div>

            <div className="pt-2">
              <Button
                onClick={handleRun}
                className="w-full h-9 text-xs font-semibold bg-primary text-primary-foreground shadow-xs"
              >
                <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                Launch Quiz
              </Button>
            </div>
          </div>

          {/* AI Prompt & Schema Specification Box */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>AI Prompt & Schema</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyPrompt}
                className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-foreground font-mono"
                title="Copy ready-to-use prompt for ChatGPT, Claude, or Gemini"
              >
                {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Copy this template into ChatGPT, Claude, or Gemini to have AI generate questions ready to paste here:
            </p>

            <pre className="text-[10px] text-muted-foreground p-2 rounded bg-background border border-border/50 overflow-x-auto max-h-48 font-mono leading-tight">
{`{
  "title": "Topic Name",
  "questions": [
    {
      "question": "Formula $E=mc^2$?",
      "options": [
        "A (2 to 6 options supported)",
        "B",
        "C",
        "D"
      ],
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
