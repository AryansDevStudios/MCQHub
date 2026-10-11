import type { GenerateQuizFromTopicInput } from '@/ai/flows/generate-quiz-from-topic';
import type { SummarizeQuizResultsInput } from '@/ai/flows/summarize-quiz-results';

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
      const prompt = `You are an academic mentor. Summarize the user's exam performance:
Quiz Title: ${input.quizTitle}
Questions: ${JSON.stringify(input.questions)}
User Selected Answers: ${JSON.stringify(input.userAnswers)}

Provide a concise diagnostic analysis in neat bulleted markdown.`;

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
