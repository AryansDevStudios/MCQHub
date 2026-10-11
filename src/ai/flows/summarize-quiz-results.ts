import { z } from 'zod';

export const SummarizeQuizResultsInputSchema = z.object({
  quizTitle: z.string().describe('The title of the quiz.'),
  questions: z.array(
    z.object({
      question: z.string(),
      correctAnswer: z.number(),
      options: z.array(z.string()).optional(),
    })
  ).describe('An array of quiz questions with their correct answers.'),
  userAnswers: z.record(z.string(), z.number()).describe("A map of question index to the user's answer."),
  customApiKey: z.string().optional().describe('Optional custom Gemini API key.'),
});

export type SummarizeQuizResultsInput = z.infer<typeof SummarizeQuizResultsInputSchema>;

export const SummarizeQuizResultsOutputSchema = z.object({
  summary: z.string().describe('A diagnostic summary of the quiz results highlighting strengths, mistakes, and recommendations.'),
});

export type SummarizeQuizResultsOutput = z.infer<typeof SummarizeQuizResultsOutputSchema>;

export async function summarizeQuizResults(
  input: SummarizeQuizResultsInput,
  customApiKey?: string
): Promise<SummarizeQuizResultsOutput> {
  const apiKey =
    customApiKey ||
    input.customApiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY_1 ||
    '';

  if (!apiKey) {
    throw new Error('Gemini API key is required. Please provide a key in settings or set GEMINI_API_KEY.');
  }

  const prompt = `You are an expert diagnostic tutor. Provide a concise, constructive assessment of this student's exam performance on "${input.quizTitle}".
Highlight:
1. Demonstrated conceptual strengths.
2. Specific mistakes and underlying misconceptions.
3. Concrete study recommendations and topics to review next.

Quiz Data:
${input.questions.map((q, idx) => {
  const userAns = input.userAnswers[String(idx)];
  const isCorrect = userAns === q.correctAnswer;
  return `Question ${idx + 1}: ${q.question}
  User Selected: ${userAns !== undefined ? (q.options ? q.options[userAns] : userAns) : 'Skipped'}
  Correct Answer: ${q.options ? q.options[q.correctAnswer] : q.correctAnswer}
  Status: ${isCorrect ? 'Correct' : 'Incorrect'}`;
}).join('\n\n')}

Format your response in neat, bulleted markdown. Keep it crisp, encouraging, and focused on learning growth.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 403 || errorText.includes('API key was reported as leaked') || errorText.includes('API_KEY_INVALID')) {
      throw new Error('Gemini API key is invalid or expired. Please provide your Google AI Studio API key in Settings.');
    }
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const summaryText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No diagnostic summary generated.';
  return { summary: summaryText };
}
