import type { GenerateQuizFromTopicInput } from '@/ai/flows/generate-quiz-from-topic';
import type { SummarizeQuizResultsInput } from '@/ai/flows/summarize-quiz-results';
import type { Quiz } from '@/lib/types';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL || 'https://mcqhub.adsbackend01.workers.dev';

/**
 * Client-safe assessment synthesis action
 * Uses Cloudflare Worker edge backend as primary server, completely eliminating
 * the need for a running Node.js server.
 */
export async function generateQuizAction(input: GenerateQuizFromTopicInput) {
  const activeKey = input.customApiKey || '';

  // 1. Edge Worker (Primary Serverless Backend)
  if (CF_WORKER_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeKey) {
        headers['Authorization'] = `Bearer ${activeKey}`;
      }

      const workerRes = await fetch(`${CF_WORKER_URL}/api/generate-quiz`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (workerRes.ok) {
        const workerData = await workerRes.json();
        if (workerData.success && workerData.data) {
          return { success: true, data: workerData.data, source: 'cloudflare-worker' };
        }
      } else {
        const errJson = await workerRes.json().catch(() => ({}));
        if (errJson?.error && errJson?.details?.includes('reported as leaked')) {
          return {
            success: false,
            error: 'Google Gemini reported the API key as expired. Please configure your key in Settings.',
          };
        }
        if (errJson?.error) {
          return { success: false, error: errJson.error };
        }
      }
    } catch (err: any) {
      console.warn('Cloudflare Worker edge attempt failed, checking fallback:', err?.message);
    }
  }

  // 2. Direct client-side Gemini fallback if custom key is provided
  if (activeKey) {
    try {
      const prompt = `You are an expert assessment creator. Generate a multiple-choice quiz on the topic of "${input.topic}".
Create exactly ${input.questionCount} questions at ${input.difficulty} level in ${input.quizStyle} style.
${input.withExplanations ? 'Include detailed step-by-step explanations.' : 'Do not include explanations.'}
${input.context ? `Use the following context:\n${input.context}` : ''}
Use Markdown and LaTeX where appropriate (e.g. $E=mc^2$).
Respond strictly in JSON matching this schema:
{
  "title": "string",
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": 0,
      "explanation": "string"
    }
  ]
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${activeKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { success: true, data: JSON.parse(text), source: 'direct-client-gemini' };
        }
      }
    } catch (err: any) {
      console.error('Direct client fallback failed:', err);
    }
  }

  return {
    success: false,
    error: 'Failed to synthesize quiz. Please check network connectivity or your API key.',
  };
}

/**
 * Diagnostic results summarization action
 */
export async function summarizeQuizResultsAction(input: SummarizeQuizResultsInput) {
  const activeKey = input.customApiKey || '';

  // 1. Edge Worker attempt
  if (CF_WORKER_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeKey) {
        headers['Authorization'] = `Bearer ${activeKey}`;
      }

      const workerRes = await fetch(`${CF_WORKER_URL}/api/summarize-results`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (workerRes.ok) {
        const workerData = await workerRes.json();
        if (workerData.success && workerData.data) {
          return {
            success: true,
            data: workerData.data.summary || workerData.data,
            source: 'cloudflare-worker',
          };
        }
      }
    } catch (err: any) {
      console.warn('Worker summarize failed:', err?.message);
    }
  }

  // 2. Direct client fallback
  if (activeKey) {
    try {
      const prompt = `You are a helpful, neutral academic tutor and study advisor.
Analyze the user's performance on the quiz: "${input.quizTitle}".
${(input as any).score !== undefined && (input as any).total ? `Score: ${(input as any).score}/${(input as any).total}.` : ''}

Questions and user answers:
${JSON.stringify(
  Array.isArray(input.questions)
    ? input.questions.map((q: any, i: number) => ({
        questionNumber: i + 1,
        question: q.question,
        correctOption: q.options ? q.options[q.correctAnswer] : q.correctAnswer,
        userAnswer: input.userAnswers && input.userAnswers[i] !== undefined && q.options ? q.options[input.userAnswers[i]] : (input.userAnswers && input.userAnswers[i] !== undefined ? input.userAnswers[i] : 'Skipped'),
        isCorrect: input.userAnswers ? input.userAnswers[i] === q.correctAnswer : undefined,
      }))
    : input.questions
)}

Guidelines:
1. Tone: Maintain a balanced, neutral, and relaxed tone (not strict, harsh, or overly critical). Analyze the results objectively and constructively.
2. Markdown & LaTeX: Write in structured Markdown with headers and bullet points. Use LaTeX notation for ALL mathematical formulas, variables, and scientific equations (e.g., inline \`$E = mc^2$\`, \`$\\lambda$\`, \`$\\Delta x$\`, or display \`$$\\frac{a}{b}$$\`). Ensure mathematical symbols and expressions render cleanly in LaTeX.
3. Structure:
   - ### Overview: A neutral, factual summary of the performance.
   - ### Strengths: Concepts and problems handled successfully.
   - ### Concepts to Review: Objective review of any mistakes, explaining the underlying principles with LaTeX formulas where helpful.
   - ### Study Recommendations: 2-3 straightforward suggestions for further practice.

Respond directly in clean Markdown.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${activeKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6 },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { success: true, data: text, source: 'direct-client-gemini' };
        }
      }
    } catch (err: any) {
      console.error('Direct summarize fallback failed:', err);
    }
  }

  return {
    success: false,
    error: 'Failed to generate diagnostic report.',
  };
}

/**
 * Create a shared assessment in Firestore through Cloudflare Worker
 */
export async function createSharedQuizAction(
  quiz: Quiz,
  createdBy?: string
): Promise<{
  success: boolean;
  shareId?: string;
  createdBy?: string;
  createdAt?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${CF_WORKER_URL}/api/share/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz, createdBy }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        shareId: data.shareId,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
      };
    }
    return { success: false, error: data.error || 'Failed to generate share link' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error sharing assessment' };
  }
}

/**
 * Retrieve a shared assessment from Firestore through Cloudflare Worker
 */
export async function getSharedQuizAction(shareId: string): Promise<{
  success: boolean;
  shareId?: string;
  quiz?: Quiz;
  createdBy?: string;
  createdAt?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${CF_WORKER_URL}/api/share/get?id=${encodeURIComponent(shareId)}`);
    const data = await res.json();
    if (res.ok && data.success && data.quiz) {
      return {
        success: true,
        shareId: data.shareId || shareId,
        quiz: data.quiz,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
      };
    }
    return { success: false, error: data.error || 'Shared assessment not found' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error loading shared assessment' };
  }
}
