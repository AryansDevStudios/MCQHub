'use server';

import {
  generateQuizFromTopic,
  type GenerateQuizFromTopicInput,
} from '@/ai/flows/generate-quiz-from-topic';
import {
  summarizeQuizResults,
  type SummarizeQuizResultsInput,
} from '@/ai/flows/summarize-quiz-results';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL || 'https://mcqhub.adsbackend01.workers.dev';

export async function generateQuizAction(input: GenerateQuizFromTopicInput) {
  const activeKey = input.customApiKey || process.env.GEMINI_API_KEY || '';

  // 1. Edge Worker attempt
  if (CF_WORKER_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

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
            error: 'Google Gemini reported the current API key as expired or leaked. Please configure your Google AI Studio API key in the top bar.',
          };
        }
      }
    } catch (err: any) {
      console.warn('Cloudflare Worker edge attempt failed, falling back to Next.js engine:', err?.message);
    }
  }

  // 2. Fallback / Direct Next.js AI Engine
  try {
    const quiz = await generateQuizFromTopic(input, activeKey);
    return { success: true, data: quiz, source: 'nextjs-gemini-engine' };
  } catch (error: any) {
    console.error('Error generating quiz:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate quiz.',
    };
  }
}

export async function summarizeQuizResultsAction(input: SummarizeQuizResultsInput) {
  const activeKey = input.customApiKey || process.env.GEMINI_API_KEY || '';

  // 1. Edge Worker attempt
  if (CF_WORKER_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

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
      console.warn('Worker summarize failed, falling back:', err?.message);
    }
  }

  // 2. Direct Next.js AI engine
  try {
    const result = await summarizeQuizResults(input, activeKey);
    return { success: true, data: result.summary, source: 'nextjs-gemini-engine' };
  } catch (error: any) {
    console.error('Error summarizing quiz:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate summary.',
    };
  }
}
