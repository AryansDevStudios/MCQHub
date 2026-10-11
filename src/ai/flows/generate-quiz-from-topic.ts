import { z } from 'zod';

export const GenerateQuizFromTopicInputSchema = z.object({
  topic: z.string().describe('The topic of the quiz.'),
  questionCount: z.number().describe('The number of questions to generate.'),
  difficulty: z.string().describe('The difficulty level of the quiz (e.g., Easy, Medium, Hard).'),
  quizStyle: z.string().describe('The style of the quiz (e.g., General, Conceptual, Problem Solving).'),
  context: z.string().optional().describe('Context to use for generating the quiz questions.'),
  withExplanations: z.boolean().optional().describe('Whether to generate explanations for the answers.'),
  customApiKey: z.string().optional().describe('Optional custom Gemini API key.'),
});

export type GenerateQuizFromTopicInput = z.infer<typeof GenerateQuizFromTopicInputSchema>;

export const QuestionSchema = z.object({
  question: z.string().describe('The quiz question.'),
  options: z.array(z.string()).describe('The possible answers to the question.'),
  correctAnswer: z.number().describe('The index of the correct answer in the options array (0-indexed).'),
  explanation: z.string().optional().describe('The explanation of why the answer is correct.'),
});

export const GenerateQuizFromTopicOutputSchema = z.object({
  title: z.string().describe('The title of the quiz.'),
  questions: z.array(QuestionSchema).describe('The questions in the quiz.'),
});

export type GenerateQuizFromTopicOutput = z.infer<typeof GenerateQuizFromTopicOutputSchema>;

/**
 * Robust generator that uses Google Gemini 3.5 Flash Lite
 */
export async function generateQuizFromTopic(
  input: GenerateQuizFromTopicInput,
  customApiKey?: string
): Promise<GenerateQuizFromTopicOutput> {
  const apiKey =
    customApiKey ||
    input.customApiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY_1 ||
    '';

  if (!apiKey) {
    throw new Error('Gemini API key is required. Please provide a key in settings or set GEMINI_API_KEY.');
  }

  const prompt = `You are an expert assessment creator. Generate a multiple-choice quiz on the topic of "${input.topic}".
Create exactly ${input.questionCount} questions.
Difficulty level: ${input.difficulty}.
Quiz style: ${input.quizStyle}.
${input.withExplanations ? 'Every question MUST include a detailed step-by-step explanation.' : 'Do not include explanations.'}
${input.context ? `Use the following reference material/context to formulate the questions:\n${input.context}` : ''}

Formatting rules:
1. You can use standard Markdown for formatting and LaTeX for mathematical expressions (e.g., inline math \`$E=mc^2$\` or display math \`$$\\int x dx$$\`).
2. Provide exactly 4 distinct options per question.
3. "correctAnswer" MUST be the 0-based integer index (0, 1, 2, or 3) of the correct option.
4. Output strictly valid JSON matching this schema:
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
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
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('No content returned by Gemini API.');
  }

  const parsed = JSON.parse(rawText);
  return GenerateQuizFromTopicOutputSchema.parse(parsed);
}
