'use client';

import React, { useState, useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Play,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  Share2,
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
      "question": "Question text here. Supports Markdown formatting and LaTeX math like $E=mc^2$ or $\\\\frac{a}{b}$.",
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
    openShareModal,
  } = useQuiz();

  const [jsonText, setJsonText] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [instantMode, setInstantMode] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Sync buffer or restore draft if available
  useEffect(() => {
    if (editorJsonBuffer) {
      setJsonText(editorJsonBuffer);
      setTitleOverride('');
    } else {
      let savedDraft: string | null = null;
      try {
        savedDraft = localStorage.getItem('mcqhub_editor_draft');
      } catch {}
      setJsonText(savedDraft || JSON.stringify(SAMPLE_QUIZ, null, 2));
      setTitleOverride('');
    }
  }, [editorJsonBuffer]);

  const handleTextChange = (val: string) => {
    setJsonText(val);
    setEditorJsonBuffer(val);
    setParseError(null);
    try {
      localStorage.setItem('mcqhub_editor_draft', val);
    } catch {}
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonText(formatted);
      setEditorJsonBuffer(formatted);
      try {
        localStorage.setItem('mcqhub_editor_draft', formatted);
      } catch {}
      setParseError(null);
      addToast('JSON formatted nicely', 'info');
    } catch (e: any) {
      setParseError(e.message);
      addToast('Invalid JSON formatting: ' + e.message, 'error');
    }
  };

  const handleLoadSample = () => {
    const sampleStr = JSON.stringify(SAMPLE_QUIZ, null, 2);
    setJsonText(sampleStr);
    setEditorJsonBuffer(sampleStr);
    try {
      localStorage.setItem('mcqhub_editor_draft', sampleStr);
    } catch {}
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
        id: `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

  const handleShare = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        setParseError('The JSON must contain a "questions" array with at least 1 question.');
        addToast('Invalid quiz: missing questions array', 'error');
        return;
      }

      for (let i = 0; i < parsed.questions.length; i++) {
        const q = parsed.questions[i];
        if (!q.question) {
          setParseError(`Question ${i + 1} is missing the "question" text.`);
          addToast(`Question ${i + 1} missing question text`, 'error');
          return;
        }
        if (!Array.isArray(q.options) || q.options.length < 2) {
          setParseError(`Question ${i + 1} must have an "options" list with at least 2 choices.`);
          addToast(`Question ${i + 1} must have at least 2 options`, 'error');
          return;
        }
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
          setParseError(`Question ${i + 1} has an invalid "correctAnswer" index.`);
          addToast(`Question ${i + 1} has invalid correctAnswer index`, 'error');
          return;
        }
      }

      const quizToShare: Quiz = {
        id: `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: titleOverride.trim() || parsed.title || 'Custom Assessment',
        questions: parsed.questions,
        createdAt: new Date().toISOString(),
      };
      setParseError(null);
      openShareModal(quizToShare);
    } catch (e: any) {
      setParseError('Invalid JSON: ' + e.message);
      addToast('Cannot share: Invalid JSON syntax', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Custom Quiz Studio (JSON)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paste or write questions in JSON format. Supports 2 to 6 options, LaTeX math, and optional explanations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            className="border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            Load Sample
          </button>
          <button
            type="button"
            onClick={handleFormatJson}
            className="border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            Format JSON
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Code Editor Panel (col-span-3) */}
        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Editor top bar */}
            <div className="px-4 py-2.5 bg-secondary/50 border-b border-border flex items-center justify-between">
              <div className="flex items-center">
                {/* macOS dots */}
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-400/40" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/40" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/40" />
                </div>
                <span className="text-xs font-mono text-muted-foreground ml-2">
                  quiz.json
                </span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                JSON Editor
              </span>
            </div>

            {/* Textarea */}
            <textarea
              value={jsonText}
              onChange={(e) => handleTextChange(e.target.value)}
              spellCheck={false}
              className="w-full p-5 font-mono text-xs leading-relaxed bg-transparent resize-y outline-none text-foreground min-h-[400px]"
              placeholder="Paste your quiz JSON here..."
            />

            {/* Error bar */}
            {parseError && (
              <div className="px-4 py-2.5 bg-destructive/5 border-t border-destructive/20 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{parseError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar (col-span-1) */}
        <div className="lg:col-span-1 space-y-4">
          {/* Setup Card */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quiz Setup
            </h3>

            {/* Title Override */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-normal">
                Title Override (Optional)
              </Label>
              <input
                type="text"
                placeholder="Leave blank to use JSON title..."
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm w-full outline-none text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary transition-shadow"
              />
            </div>

            {/* Instant Mode Toggle Row */}
            <div className="flex items-center justify-between pt-1">
              <div className="space-y-0.5">
                <Label htmlFor="editor-instant" className="text-xs cursor-pointer text-foreground font-medium">
                  Instant Feedback
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Check answers per-question
                </p>
              </div>
              <Switch
                id="editor-instant"
                checked={instantMode}
                onCheckedChange={setInstantMode}
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRun}
                className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Play className="w-4 h-4 fill-current" />
                Launch Quiz
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="w-full border border-border rounded-xl py-2.5 text-sm text-muted-foreground hover:bg-secondary flex items-center justify-center gap-2 mt-2 transition-colors"
                title="Share this assessment"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>

          {/* AI Prompt Card */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                AI Prompt
              </h3>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="text-xs text-primary hover:underline flex items-center gap-1 transition-colors"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Copy this template into ChatGPT, Claude, or Gemini to have AI generate questions ready to paste here:
            </p>

            <pre className="bg-secondary/50 rounded-xl p-3 font-mono text-[10px] text-muted-foreground overflow-x-auto max-h-44 border border-border leading-relaxed">
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
