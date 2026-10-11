import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

let keyIndex = 0;

function getApiKey(): string {
  const keyCount = parseInt(process.env.GEMINI_API_KEY_COUNT || '1', 10);
  
  if (keyCount <= 1) {
    return process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || '';
  }

  const currentKeyIndex = (keyIndex % keyCount) + 1;
  const apiKey = process.env[`GEMINI_API_KEY_${currentKeyIndex}`];
  keyIndex++;
  
  return apiKey || process.env.GEMINI_API_KEY || '';
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: getApiKey(),
    }),
  ],
  model: 'googleai/gemini-2.5-flash-lite',
});
