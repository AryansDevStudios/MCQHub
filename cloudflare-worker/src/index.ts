/**
 * MCQHub Cloudflare Worker Backend Handler
 * Features:
 * - Direct Firestore REST API integration (Bypasses browser ad-blockers & net::ERR_BLOCKED_BY_CLIENT)
 * - User Authentication (Register, Login, Token generation, Session audit)
 * - User Data Persistence (Quizzes library, History attempt logs, Active exam sync)
 * - Edge AI proxy to Google Gemini 3.5 Flash Lite
 * - High-Precision SNTP Clock Calibration
 * - Model Context Protocol (MCP) JSON-RPC 2.0 Gateway (10 Specialized Tools)
 */

export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEFAULT_FIREBASE_API_KEY = 'AIzaSyATzfV9pFDedahaiCwjrbELK9r21jKQ2As';
const DEFAULT_FIREBASE_PROJECT_ID = 'mcqhub-724e3';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const MCQ_HUB_PUBLIC_BASE = 'https://mcqhub.pages.dev';

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function sanitizeUsername(username: string): string {
  return (username || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function hashPassword(pass: string): string {
  return btoa(`mcqhub:${pass}`);
}

function getFirestoreApiKey(env: Env): string {
  return env.FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY;
}

function getFirestoreBaseUrl(env: Env): string {
  const projectId = env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
  const apiKey = getFirestoreApiKey(env);
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function getGeminiApiKey(env: Env, override?: string): string {
  const key = override || env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API key is required. Please set GEMINI_API_KEY in Worker environment or provide Bearer token.');
  }
  return key;
}

function getGeminiModel(env: Env): string {
  return env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

async function getFirestoreDoc(env: Env, path: string): Promise<any | null> {
  const apiKey = getFirestoreApiKey(env);
  const url = `${getFirestoreBaseUrl(env)}/${path}?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Firestore read error: ${res.statusText}`);
  }
  const data: any = await res.json();
  return data;
}

async function patchFirestoreDoc(env: Env, path: string, fields: Record<string, any>, maskFields?: string[]): Promise<any> {
  const apiKey = getFirestoreApiKey(env);
  let url = `${getFirestoreBaseUrl(env)}/${path}?key=${apiKey}`;
  if (maskFields && maskFields.length > 0) {
    url += maskFields.map(f => `&updateMask.fieldPaths=${encodeURIComponent(f)}`).join('');
  }

  const firestoreFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'number') {
      firestoreFields[k] = Number.isInteger(v) ? { integerValue: v.toString() } : { doubleValue: v };
    } else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
    else if (v === null || v === undefined) firestoreFields[k] = { nullValue: null };
    else firestoreFields[k] = { stringValue: JSON.stringify(v) };
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore write error: ${res.status} - ${errText}`);
  }
  return res.json();
}

function parseDocFields(doc: any): Record<string, any> {
  if (!doc || !doc.fields) return {};
  const res: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields as Record<string, any>)) {
    if ('stringValue' in v) {
      const str = v.stringValue;
      if ((str.startsWith('[') && str.endsWith(']')) || (str.startsWith('{') && str.endsWith('}'))) {
        try {
          res[k] = JSON.parse(str);
          continue;
        } catch {}
      }
      res[k] = str;
    } else if ('integerValue' in v) {
      res[k] = parseInt(v.integerValue, 10);
    } else if ('doubleValue' in v) {
      res[k] = parseFloat(v.doubleValue);
    } else if ('booleanValue' in v) {
      res[k] = v.booleanValue;
    } else if ('nullValue' in v) {
      res[k] = null;
    } else {
      res[k] = v;
    }
  }
  return res;
}

async function generateUnique5DigitCode(env: Env): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const candidate = Math.floor(10000 + Math.random() * 90000).toString();
    const doc = await getFirestoreDoc(env, `shared_quizzes/${candidate}`);
    if (!doc) {
      return candidate;
    }
    attempts++;
  }
  return Math.floor(10000 + Math.random() * 90000).toString();
}

async function callGeminiGenerateQuiz(
  env: Env,
  topic: string,
  questionCount: number = 5,
  difficulty: string = 'Medium',
  quizStyle: string = 'General',
  context: string = '',
  withExplanations: boolean = true,
  apiKeyOverride?: string
): Promise<any> {
  const apiKey = getGeminiApiKey(env, apiKeyOverride);
  const model = getGeminiModel(env);

  const systemPrompt = `You are an expert academic assessment creator. Create a multiple-choice quiz on the topic "${topic}".
Generate exactly ${questionCount} questions at ${difficulty} level with style "${quizStyle}".
${withExplanations ? 'Include detailed step-by-step explanations for each question.' : 'Do not include explanations.'}
${context ? `Use the following context:\n${context}` : ''}
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

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${errText}`);
  }

  const data: any = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned an empty response');
  }
  return JSON.parse(text);
}

async function callGeminiSummarize(
  env: Env,
  quizTitle: string,
  score: number,
  total: number,
  questions: any[],
  userAnswers: any[],
  apiKeyOverride?: string
): Promise<string> {
  const apiKey = getGeminiApiKey(env, apiKeyOverride);
  const model = getGeminiModel(env);

  const prompt = `You are a helpful, neutral academic tutor and study advisor.
Analyze the user's performance on the quiz: "${quizTitle}".
${score !== undefined && total ? `Score: ${score}/${total} (${Math.round((score / total) * 100)}%).` : ''}

Questions and user answers:
${JSON.stringify(
  Array.isArray(questions)
    ? questions.map((q: any, i: number) => ({
        questionNumber: i + 1,
        question: q.question,
        correctOption: q.options ? q.options[q.correctAnswer] : q.correctAnswer,
        userAnswer: userAnswers && userAnswers[i] !== undefined && q.options ? q.options[userAnswers[i]] : (userAnswers && userAnswers[i] !== undefined ? userAnswers[i] : 'Skipped'),
        isCorrect: userAnswers ? userAnswers[i] === q.correctAnswer : undefined,
      }))
    : questions
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

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${errText}`);
  }

  const data: any = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ---------------------------------------------------------
// MCP (Model Context Protocol) Tools Definitions
// ---------------------------------------------------------
const MCP_TOOLS_DEFINITIONS = [
  {
    name: 'generate_and_share_quiz',
    description: 'Generate an academic multiple-choice quiz using Gemini 3.5 Flash Lite, automatically publish it to MCQHub with a 5-digit numeric share code, and generate a public interactive test link. Can optionally dispatch directly to a signed-in user library in Firestore.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Academic subject, chapter, or topic (e.g., "Class 10 Chemical Reactions and Equations", "Calculus Integrals")' },
        questionCount: { type: 'number', description: 'Number of questions to generate (1 to 30, default: 5)' },
        difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'], description: 'Difficulty tier (default: Medium)' },
        quizStyle: { type: 'string', enum: ['General', 'Conceptual', 'Problem Solving', 'Board Exam Prep'], description: 'Quiz style focus (default: General)' },
        context: { type: 'string', description: 'Optional context, notes, or chapter excerpts to ground the questions' },
        withExplanations: { type: 'boolean', description: 'Whether to include detailed step-by-step explanations (default: true)' },
        authorUsername: { type: 'string', description: 'Optional username of the creator or signed-in user' },
        saveToUserLibrary: { type: 'boolean', description: 'Whether to dispatch and save the generated quiz directly to the user library in Firestore (default: false)' },
        visibility: { type: 'string', enum: ['public', 'private'], description: 'Assessment visibility (default: public)' },
      },
      required: ['topic'],
    },
  },
  {
    name: 'create_custom_quiz',
    description: 'Publish a custom quiz with handcrafted questions directly to MCQHub, generating an immutable 5-digit share PIN and public interactive link.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the assessment' },
        description: { type: 'string', description: 'Optional description or instructions' },
        questions: {
          type: 'array',
          description: 'Array of questions',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'Question text with Markdown/LaTeX support' },
              options: { type: 'array', items: { type: 'string' }, description: 'Array of option choices (typically 4)' },
              correctAnswer: { type: 'number', description: '0-indexed index of correct option' },
              explanation: { type: 'string', description: 'Optional step-by-step explanation' },
            },
            required: ['question', 'options', 'correctAnswer'],
          },
        },
        authorUsername: { type: 'string', description: 'Optional creator username' },
        saveToUserLibrary: { type: 'boolean', description: 'Whether to save to the author personal library (default: false)' },
      },
      required: ['title', 'questions'],
    },
  },
  {
    name: 'get_quiz_by_share_code',
    description: 'Retrieve any quiz published on MCQHub using its 5-digit numeric share code.',
    inputSchema: {
      type: 'object',
      properties: {
        shareCode: { type: 'string', description: 'The 5-digit numeric share code (e.g. "48921")' },
      },
      required: ['shareCode'],
    },
  },
  {
    name: 'login_user',
    description: 'Authenticate an MCQHub user account to verify credentials and retrieve profile details.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Account username' },
        password: { type: 'string', description: 'Account password' },
      },
      required: ['username', 'password'],
    },
  },
  {
    name: 'register_user',
    description: 'Register a new user account on MCQHub edge Firestore backend.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Desired username (minimum 3 alphanumeric characters)' },
        password: { type: 'string', description: 'Desired password (minimum 4 characters)' },
        displayName: { type: 'string', description: 'Optional display name' },
      },
      required: ['username', 'password'],
    },
  },
  {
    name: 'get_user_library',
    description: 'Retrieve all quizzes and assessments saved in a user personal library.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Account username' },
      },
      required: ['username'],
    },
  },
  {
    name: 'save_quiz_to_library',
    description: 'Save a quiz by its 5-digit share code or quiz payload into a user personal library.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Target user username' },
        shareCode: { type: 'string', description: '5-digit numeric share code to import' },
        quiz: { type: 'object', description: 'Optional full quiz payload to save directly' },
      },
      required: ['username'],
    },
  },
  {
    name: 'get_user_history',
    description: 'Retrieve past quiz attempts, scores, and any unsubmitted or active in-progress assessment for a user.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Account username' },
      },
      required: ['username'],
    },
  },
  {
    name: 'analyze_quiz_results',
    description: 'Run AI Tutor analysis on a student quiz performance, generating detailed Markdown and LaTeX recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        quizTitle: { type: 'string', description: 'Assessment title' },
        score: { type: 'number', description: 'Achieved score' },
        total: { type: 'number', description: 'Total possible score' },
        questions: { type: 'array', description: 'List of question objects' },
        userAnswers: { type: 'array', description: 'User selected answer indexes' },
      },
      required: ['quizTitle', 'score', 'total', 'questions', 'userAnswers'],
    },
  },
  {
    name: 'get_system_status',
    description: 'Check MCQHub edge server health, Firestore database latency, active Cloudflare data center (colo), and Gemini AI model.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function executeMcpTool(env: Env, name: string, args: any, cfData: any, authHeader?: string): Promise<any> {
  const apiKeyOverride = authHeader ? authHeader.replace('Bearer ', '').trim() : undefined;

  switch (name) {
    case 'generate_and_share_quiz': {
      const topic = args?.topic;
      if (!topic) throw new Error('topic is required');
      const questionCount = Math.min(Math.max(parseInt(args?.questionCount, 10) || 5, 1), 30);
      const difficulty = args?.difficulty || 'Medium';
      const quizStyle = args?.quizStyle || 'General';
      const context = args?.context || '';
      const withExplanations = args?.withExplanations !== false;
      const authorUsername = args?.authorUsername?.trim();
      const saveToUserLibrary = !!args?.saveToUserLibrary;
      const visibility = args?.visibility || 'public';

      const parsedQuiz = await callGeminiGenerateQuiz(
        env,
        topic,
        questionCount,
        difficulty,
        quizStyle,
        context,
        withExplanations,
        apiKeyOverride
      );

      const shareCode = await generateUnique5DigitCode(env);
      const creator = authorUsername || 'MCQHub AI Tutor';
      const createdAt = new Date().toISOString();
      const quizId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const quizObj = {
        ...parsedQuiz,
        id: quizId,
        shareId: shareCode,
        createdBy: creator,
        originalCreator: creator,
        createdAt,
        visibility,
      };

      // Store in shared_quizzes collection
      await patchFirestoreDoc(env, `shared_quizzes/${shareCode}`, {
        shareId: shareCode,
        quiz: quizObj,
        createdBy: creator,
        originalCreator: creator,
        createdAt,
        visibility,
      });

      let savedToLibrary = false;
      if (saveToUserLibrary && authorUsername) {
        const cleanUser = sanitizeUsername(authorUsername);
        const userDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
        if (userDoc) {
          const userData = parseDocFields(userDoc);
          const existingQuizzes = Array.isArray(userData.quizzes) ? userData.quizzes : [];
          const updated = [quizObj, ...existingQuizzes.filter((q: any) => q.shareId !== shareCode && q.id !== quizObj.id)];
          await patchFirestoreDoc(env, `users/${cleanUser}`, { quizzes: updated }, ['quizzes']);
          savedToLibrary = true;
        }
      }

      const publicLink = `${MCQ_HUB_PUBLIC_BASE}/?share=${shareCode}`;
      const directQuizLink = `${MCQ_HUB_PUBLIC_BASE}/quiz?share=${shareCode}`;

      return {
        success: true,
        shareCode,
        publicLink,
        directQuizLink,
        title: quizObj.title,
        questionCount: quizObj.questions.length,
        originalCreator: creator,
        createdAt,
        savedToLibrary,
        quiz: quizObj,
      };
    }

    case 'create_custom_quiz': {
      const { title, questions, description, authorUsername, saveToUserLibrary } = args;
      if (!title || !Array.isArray(questions) || questions.length === 0) {
        throw new Error('Valid title and at least 1 question are required');
      }

      const shareCode = await generateUnique5DigitCode(env);
      const creator = authorUsername?.trim() || 'Custom Creator';
      const createdAt = new Date().toISOString();
      const quizId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const quizObj = {
        id: quizId,
        title,
        description: description || '',
        questions,
        shareId: shareCode,
        createdBy: creator,
        originalCreator: creator,
        createdAt,
      };

      await patchFirestoreDoc(env, `shared_quizzes/${shareCode}`, {
        shareId: shareCode,
        quiz: quizObj,
        createdBy: creator,
        originalCreator: creator,
        createdAt,
      });

      let savedToLibrary = false;
      if (saveToUserLibrary && authorUsername) {
        const cleanUser = sanitizeUsername(authorUsername);
        const userDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
        if (userDoc) {
          const userData = parseDocFields(userDoc);
          const existingQuizzes = Array.isArray(userData.quizzes) ? userData.quizzes : [];
          const updated = [quizObj, ...existingQuizzes.filter((q: any) => q.shareId !== shareCode && q.id !== quizObj.id)];
          await patchFirestoreDoc(env, `users/${cleanUser}`, { quizzes: updated }, ['quizzes']);
          savedToLibrary = true;
        }
      }

      return {
        success: true,
        shareCode,
        publicLink: `${MCQ_HUB_PUBLIC_BASE}/?share=${shareCode}`,
        directQuizLink: `${MCQ_HUB_PUBLIC_BASE}/quiz?share=${shareCode}`,
        title,
        questionCount: questions.length,
        originalCreator: creator,
        savedToLibrary,
        quiz: quizObj,
      };
    }

    case 'get_quiz_by_share_code': {
      const shareCode = (args?.shareCode || '').toString().trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (!shareCode) throw new Error('5-digit shareCode is required');

      const doc = await getFirestoreDoc(env, `shared_quizzes/${shareCode}`);
      if (!doc) throw new Error(`Quiz with 5-digit share code '${shareCode}' was not found`);

      const data = parseDocFields(doc);
      const origCreator = data.originalCreator || data.createdBy || (data.quiz && (data.quiz.originalCreator || data.quiz.createdBy)) || 'Anonymous';
      const origCreatedAt = data.createdAt || (data.quiz && data.quiz.createdAt) || new Date().toISOString();

      return {
        success: true,
        shareCode,
        publicLink: `${MCQ_HUB_PUBLIC_BASE}/?share=${shareCode}`,
        directQuizLink: `${MCQ_HUB_PUBLIC_BASE}/quiz?share=${shareCode}`,
        originalCreator: origCreator,
        createdAt: origCreatedAt,
        quiz: data.quiz || data,
      };
    }

    case 'login_user': {
      const { username, password } = args;
      const cleanUser = sanitizeUsername(username);
      if (!cleanUser || !password) throw new Error('Username and password are required');

      const userDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
      if (!userDoc) throw new Error(`User '${cleanUser}' does not exist`);

      const userData = parseDocFields(userDoc);
      if (userData.passwordHash !== hashPassword(password)) {
        throw new Error('Incorrect password');
      }

      const now = new Date().toISOString();
      const tokenId = `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
      const newSession = {
        tokenId,
        timestamp: now,
        userAgent: 'MCP Client',
        edgeColo: cfData.colo || 'LOCAL',
        status: 'active',
      };

      const existingSessions = Array.isArray(userData.sessions) ? userData.sessions : [];
      const updatedSessions = [newSession, ...existingSessions.slice(0, 19)];

      await patchFirestoreDoc(env, `users/${cleanUser}`, {
        sessions: updatedSessions,
        lastLogin: now,
      }, ['sessions', 'lastLogin']);

      return {
        success: true,
        profile: {
          userId: userData.userId,
          username: userData.username,
          displayName: userData.displayName,
          createdAt: userData.createdAt,
          lastLogin: now,
        },
        session: newSession,
        savedQuizzesCount: (userData.quizzes || []).length,
        historyAttemptsCount: (userData.history || []).length,
      };
    }

    case 'register_user': {
      const { username, password, displayName } = args;
      const cleanUser = sanitizeUsername(username);
      if (!cleanUser || cleanUser.length < 3) throw new Error('Username must be at least 3 characters');
      if (!password || password.length < 4) throw new Error('Password must be at least 4 characters');

      const existingDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
      if (existingDoc) throw new Error(`Username '${cleanUser}' is already registered`);

      const now = new Date().toISOString();
      const userId = `usr_${cleanUser}_${Math.random().toString(36).substring(2, 7)}`;
      const tokenId = `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

      const initialSession = {
        tokenId,
        timestamp: now,
        userAgent: 'MCP Client',
        edgeColo: cfData.colo || 'LOCAL',
        status: 'active',
      };

      const profile = {
        userId,
        username: cleanUser,
        displayName: displayName?.trim() || cleanUser,
        createdAt: now,
        lastLogin: now,
      };

      await patchFirestoreDoc(env, `users/${cleanUser}`, {
        userId,
        username: cleanUser,
        displayName: profile.displayName,
        passwordHash: hashPassword(password),
        sessions: [initialSession],
        quizzes: [],
        history: [],
        createdAt: now,
        lastLogin: now,
      });

      return {
        success: true,
        message: 'User registered successfully on edge Firestore database',
        profile,
        session: initialSession,
      };
    }

    case 'get_user_library': {
      const cleanUser = sanitizeUsername(args?.username);
      if (!cleanUser) throw new Error('Username is required');

      const userDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
      if (!userDoc) throw new Error(`User '${cleanUser}' not found`);

      const userData = parseDocFields(userDoc);
      const quizzes = Array.isArray(userData.quizzes) ? userData.quizzes : [];

      return {
        success: true,
        username: cleanUser,
        count: quizzes.length,
        quizzes: quizzes.map((q: any) => ({
          id: q.id,
          title: q.title,
          questionCount: q.questions?.length || 0,
          shareId: q.shareId || null,
          shareLink: q.shareId ? `${MCQ_HUB_PUBLIC_BASE}/?share=${q.shareId}` : null,
          createdAt: q.createdAt,
          originalCreator: q.originalCreator || q.createdBy || 'Anonymous',
        })),
      };
    }

    case 'save_quiz_to_library': {
      const cleanUser = sanitizeUsername(args?.username);
      if (!cleanUser) throw new Error('Username is required');

      const userDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
      if (!userDoc) throw new Error(`User '${cleanUser}' not found`);

      let targetQuiz = args?.quiz;
      if (!targetQuiz && args?.shareCode) {
        const cleanCode = args.shareCode.toString().trim().replace(/[^a-zA-Z0-9_-]/g, '');
        const sharedDoc = await getFirestoreDoc(env, `shared_quizzes/${cleanCode}`);
        if (!sharedDoc) throw new Error(`Shared quiz '${cleanCode}' not found`);
        const parsed = parseDocFields(sharedDoc);
        targetQuiz = parsed.quiz || parsed;
      }

      if (!targetQuiz || !targetQuiz.title) {
        throw new Error('Either shareCode or full quiz object is required');
      }

      const userData = parseDocFields(userDoc);
      const existingQuizzes = Array.isArray(userData.quizzes) ? userData.quizzes : [];
      const updated = [
        targetQuiz,
        ...existingQuizzes.filter((q: any) => q.shareId !== targetQuiz.shareId && q.id !== targetQuiz.id),
      ];

      await patchFirestoreDoc(env, `users/${cleanUser}`, { quizzes: updated }, ['quizzes']);

      return {
        success: true,
        message: `Quiz "${targetQuiz.title}" successfully saved to library of ${cleanUser}`,
        quizTitle: targetQuiz.title,
        shareId: targetQuiz.shareId || null,
        totalLibraryCount: updated.length,
      };
    }

    case 'get_user_history': {
      const cleanUser = sanitizeUsername(args?.username);
      if (!cleanUser) throw new Error('Username is required');

      const userDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
      if (!userDoc) throw new Error(`User '${cleanUser}' not found`);

      const userData = parseDocFields(userDoc);
      return {
        success: true,
        username: cleanUser,
        totalAttempts: (userData.history || []).length,
        history: userData.history || [],
        activeExam: userData.activeExam || null,
      };
    }

    case 'analyze_quiz_results': {
      const { quizTitle, score, total, questions, userAnswers } = args;
      if (!quizTitle || score === undefined || total === undefined) {
        throw new Error('quizTitle, score, and total are required');
      }

      const analysis = await callGeminiSummarize(
        env,
        quizTitle,
        score,
        total,
        questions || [],
        userAnswers || [],
        apiKeyOverride
      );

      return {
        success: true,
        quizTitle,
        score,
        total,
        percentage: Math.round((score / total) * 100),
        analysis,
      };
    }

    case 'get_system_status': {
      const startTime = Date.now();
      let firestoreOk = false;
      let latency = 0;

      try {
        await patchFirestoreDoc(env, 'system/heuristic', {
          ping: Date.now(),
          client: 'MCQHub MCP Gateway',
          edgeColo: cfData.colo || 'LOCAL',
          country: cfData.country || 'N/A',
          timestamp: new Date().toISOString(),
        });
        latency = Date.now() - startTime;
        firestoreOk = true;
      } catch (err: any) {
        latency = Date.now() - startTime;
      }

      return {
        status: 'online',
        service: 'MCQHub Edge MCP Server',
        version: '1.0.0',
        edgeColo: cfData.colo || 'LOCAL',
        country: cfData.country || 'N/A',
        firestore: {
          ok: firestoreOk,
          latencyMs: latency,
          projectId: env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID,
        },
        gemini: {
          model: getGeminiModel(env),
          ready: true,
        },
        mcpEndpoints: {
          httpRpc: 'https://mcqhub.adsbackend01.workers.dev/api/mcp',
          appFrontend: MCQ_HUB_PUBLIC_BASE,
        },
      };
    }

    default:
      throw new Error(`Tool "${name}" is not implemented`);
  }
}

// ---------------------------------------------------------
// Main Cloudflare Worker Fetch Handler
// ---------------------------------------------------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const cfData = (request as any).cf || {};

    try {
      // 1. Health & Heuristic check endpoint
      if (url.pathname === '/api/heuristic' || url.pathname === '/api/health') {
        const startTime = Date.now();
        const pingTimestamp = new Date().toISOString();
        let firestoreOk = false;
        let firestoreLatency = 0;
        let firestoreError = null;

        try {
          await patchFirestoreDoc(env, 'system/heuristic', {
            ping: Date.now(),
            client: 'MCQHub Cloudflare Worker',
            edgeColo: cfData.colo || 'LOCAL',
            country: cfData.country || 'N/A',
            timestamp: pingTimestamp,
          });
          firestoreLatency = Date.now() - startTime;
          firestoreOk = true;
        } catch (err: any) {
          firestoreLatency = Date.now() - startTime;
          firestoreError = err.message;
        }

        return jsonResponse({
          ok: true,
          status: 'online',
          service: 'MCQHub Cloudflare Worker',
          edgeColo: cfData.colo || 'LOCAL',
          country: cfData.country || 'N/A',
          latencyMs: firestoreLatency,
          timestamp: pingTimestamp,
          firestore: {
            ok: firestoreOk,
            latencyMs: firestoreLatency,
            database: `projects/${env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID}/databases/(default)`,
            error: firestoreError,
          },
        });
      }

      // 2. Auth: Register endpoint
      if (url.pathname === '/api/auth/register' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const { username, password, displayName } = body;
        const cleanUser = sanitizeUsername(username);

        if (!cleanUser || cleanUser.length < 3) {
          return jsonResponse({ success: false, error: 'Username must be at least 3 alphanumeric characters' }, 400);
        }
        if (!password || password.length < 4) {
          return jsonResponse({ success: false, error: 'Password must be at least 4 characters' }, 400);
        }

        const existingDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
        if (existingDoc) {
          return jsonResponse({ success: false, error: 'Username already registered. Please sign in.' }, 409);
        }

        const now = new Date().toISOString();
        const userId = `usr_${cleanUser}_${Math.random().toString(36).substring(2, 7)}`;
        const userAgent = request.headers.get('User-Agent') || 'Web Browser';
        const tokenId = `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

        const initialSession = {
          tokenId,
          timestamp: now,
          userAgent,
          edgeColo: cfData.colo || 'LOCAL',
          status: 'active',
        };

        const profile = {
          userId,
          username: cleanUser,
          displayName: displayName?.trim() || cleanUser,
          createdAt: now,
          lastLogin: now,
        };

        await patchFirestoreDoc(env, `users/${cleanUser}`, {
          userId,
          username: cleanUser,
          displayName: profile.displayName,
          passwordHash: hashPassword(password),
          sessions: [initialSession],
          quizzes: [],
          history: [],
          createdAt: now,
          lastLogin: now,
        });

        return jsonResponse({
          success: true,
          profile,
          session: initialSession,
        });
      }

      // 3. Auth: Login endpoint
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const { username, password } = body;
        const cleanUser = sanitizeUsername(username);

        if (!cleanUser || !password) {
          return jsonResponse({ success: false, error: 'Username and password are required' }, 400);
        }

        const userDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
        if (!userDoc) {
          return jsonResponse({ success: false, error: 'User does not exist. Please register first.' }, 404);
        }

        const userData = parseDocFields(userDoc);
        if (userData.passwordHash !== hashPassword(password)) {
          return jsonResponse({ success: false, error: 'Incorrect password.' }, 401);
        }

        const now = new Date().toISOString();
        const tokenId = `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
        const newSession = {
          tokenId,
          timestamp: now,
          userAgent: request.headers.get('User-Agent') || 'Web Browser',
          edgeColo: cfData.colo || 'LOCAL',
          status: 'active',
        };

        const existingSessions = Array.isArray(userData.sessions) ? userData.sessions : [];
        const updatedSessions = [newSession, ...existingSessions.slice(0, 19)];

        await patchFirestoreDoc(
          env,
          `users/${cleanUser}`,
          {
            sessions: updatedSessions,
            lastLogin: now,
          },
          ['sessions', 'lastLogin']
        );

        const profile = {
          userId: userData.userId,
          username: userData.username,
          displayName: userData.displayName,
          createdAt: userData.createdAt,
          lastLogin: now,
        };

        return jsonResponse({
          success: true,
          profile,
          session: newSession,
          quizzes: Array.isArray(userData.quizzes) ? userData.quizzes : [],
          history: Array.isArray(userData.history) ? userData.history : [],
          activeExam: userData.activeExam || null,
          encryptedApiKey: userData.encryptedApiKey || null,
          syncAiSettings: !!userData.syncAiSettings,
        });
      }

      // 4. Auth: Get Sessions endpoint
      if (url.pathname === '/api/auth/sessions' && request.method === 'GET') {
        const username = url.searchParams.get('username') || '';
        const cleanUser = sanitizeUsername(username);
        if (!cleanUser) {
          return jsonResponse({ success: false, error: 'Username required' }, 400);
        }

        const userDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
        if (!userDoc) {
          return jsonResponse({ success: false, error: 'User not found' }, 404);
        }

        const userData = parseDocFields(userDoc);
        return jsonResponse({
          success: true,
          sessions: Array.isArray(userData.sessions) ? userData.sessions : [],
        });
      }

      // 5. User Data: Get Quizzes & History
      if (url.pathname === '/api/user/data' && request.method === 'GET') {
        const username = url.searchParams.get('username') || '';
        const cleanUser = sanitizeUsername(username);
        if (!cleanUser) {
          return jsonResponse({ success: false, error: 'Username required' }, 400);
        }

        const userDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
        if (!userDoc) {
          return jsonResponse({ success: false, error: 'User not found' }, 404);
        }

        const userData = parseDocFields(userDoc);
        return jsonResponse({
          success: true,
          profile: {
            userId: userData.userId,
            username: userData.username,
            displayName: userData.displayName,
            createdAt: userData.createdAt,
            lastLogin: userData.lastLogin,
          },
          quizzes: Array.isArray(userData.quizzes) ? userData.quizzes : [],
          history: Array.isArray(userData.history) ? userData.history : [],
          sessions: Array.isArray(userData.sessions) ? userData.sessions : [],
          activeExam: userData.activeExam || null,
          encryptedApiKey: userData.encryptedApiKey || null,
          syncAiSettings: !!userData.syncAiSettings,
        });
      }

      // 6. User Data: Save Quizzes
      if (url.pathname === '/api/user/quizzes' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const { username, quizzes } = body;
        const cleanUser = sanitizeUsername(username);
        if (!cleanUser) {
          return jsonResponse({ success: false, error: 'Username required' }, 400);
        }

        await patchFirestoreDoc(
          env,
          `users/${cleanUser}`,
          { quizzes: Array.isArray(quizzes) ? quizzes : [] },
          ['quizzes']
        );

        return jsonResponse({ success: true, count: Array.isArray(quizzes) ? quizzes.length : 0 });
      }

      // 7. User Data: Save History
      if (url.pathname === '/api/user/history' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const { username, history } = body;
        const cleanUser = sanitizeUsername(username);
        if (!cleanUser) {
          return jsonResponse({ success: false, error: 'Username required' }, 400);
        }

        await patchFirestoreDoc(
          env,
          `users/${cleanUser}`,
          { history: Array.isArray(history) ? history : [] },
          ['history']
        );

        return jsonResponse({ success: true, count: Array.isArray(history) ? history.length : 0 });
      }

      // 7b. User Data: Active Exam Sync (Cross-Device Live State)
      if (url.pathname === '/api/user/active-exam') {
        const serverTimeMs = Date.now();
        if (request.method === 'POST') {
          const body = (await request.json()) as any;
          const { username, activeExam } = body;
          const cleanUser = sanitizeUsername(username);
          if (!cleanUser) {
            return jsonResponse({ success: false, error: 'Username required' }, 400);
          }

          const examToSave = activeExam
            ? { ...activeExam, serverAnchorTimeMs: serverTimeMs }
            : null;

          await patchFirestoreDoc(
            env,
            `users/${cleanUser}`,
            { activeExam: examToSave },
            ['activeExam']
          );

          return jsonResponse({ success: true, serverTimeMs });
        }

        if (request.method === 'GET') {
          const username = url.searchParams.get('username') || '';
          const cleanUser = sanitizeUsername(username);
          if (!cleanUser) {
            return jsonResponse({ success: false, error: 'Username required' }, 400);
          }

          const userDoc = await getFirestoreDoc(env, `users/${cleanUser}`);
          if (!userDoc) {
            return jsonResponse({ success: false, error: 'User not found' }, 404);
          }

          const userData = parseDocFields(userDoc);
          return jsonResponse({
            success: true,
            activeExam: userData.activeExam || null,
            serverTimeMs,
          });
        }
      }

      // 7b-2. Dedicated Edge Atomic Time Endpoint for High-Precision SNTP Clock Calibration
      if (url.pathname === '/api/time' && request.method === 'GET') {
        return jsonResponse({
          serverTimeMs: Date.now(),
          iso: new Date().toISOString(),
        });
      }

      // 7c. Share Quiz: Create Shareable Assessment (5-Digit Code & Immutable Original Creator)
      if (url.pathname === '/api/share/create' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const { quiz, createdBy } = body;
        if (!quiz || !quiz.title || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
          return jsonResponse({ success: false, error: 'Valid quiz with questions is required' }, 400);
        }

        let finalShareId: string | null = null;
        const providedShareId = (quiz.shareId || '').toString().trim();

        if (providedShareId && /^\d{5}$/.test(providedShareId)) {
          finalShareId = providedShareId;
          const existingDoc = await getFirestoreDoc(env, `shared_quizzes/${finalShareId}`);
          if (existingDoc) {
            const data = parseDocFields(existingDoc);
            const origCreator = data.originalCreator || data.createdBy || quiz.originalCreator || quiz.createdBy || 'Anonymous';
            const origCreatedAt = data.createdAt || quiz.createdAt || new Date().toISOString();
            return jsonResponse({
              success: true,
              shareId: finalShareId,
              createdBy: origCreator,
              originalCreator: origCreator,
              createdAt: origCreatedAt,
            });
          }
        }

        if (!finalShareId) {
          finalShareId = await generateUnique5DigitCode(env);
        }

        const originalCreator = quiz.originalCreator || quiz.createdBy || createdBy || 'Anonymous';
        const originalCreatedAt = quiz.createdAt || new Date().toISOString();

        const payloadQuiz = {
          ...quiz,
          shareId: finalShareId,
          createdBy: originalCreator,
          originalCreator,
          createdAt: originalCreatedAt,
        };

        await patchFirestoreDoc(
          env,
          `shared_quizzes/${finalShareId}`,
          {
            shareId: finalShareId,
            quiz: payloadQuiz,
            createdBy: originalCreator,
            originalCreator,
            createdAt: originalCreatedAt,
          }
        );

        return jsonResponse({
          success: true,
          shareId: finalShareId,
          createdBy: originalCreator,
          originalCreator,
          createdAt: originalCreatedAt,
        });
      }

      // 7d. Share Quiz: Retrieve Shared Assessment from Firestore
      if (url.pathname === '/api/share/get' && request.method === 'GET') {
        const id = url.searchParams.get('id') || '';
        const cleanId = id.trim().replace(/[^a-zA-Z0-9_-]/g, '');
        if (!cleanId) {
          return jsonResponse({ success: false, error: '5-digit Share Code is required' }, 400);
        }

        const doc = await getFirestoreDoc(env, `shared_quizzes/${cleanId}`);
        if (!doc) {
          return jsonResponse({ success: false, error: 'Shared assessment not found. Please verify the 5-digit code.' }, 404);
        }

        const data = parseDocFields(doc);
        const originalCreator = data.originalCreator || data.createdBy || (data.quiz && (data.quiz.originalCreator || data.quiz.createdBy)) || 'Anonymous';
        const originalCreatedAt = data.createdAt || (data.quiz && data.quiz.createdAt) || new Date().toISOString();

        const returnedQuiz = {
          ...(data.quiz || {}),
          shareId: data.shareId || cleanId,
          createdBy: originalCreator,
          originalCreator,
          createdAt: originalCreatedAt,
        };

        return jsonResponse({
          success: true,
          shareId: data.shareId || cleanId,
          quiz: returnedQuiz,
          createdBy: originalCreator,
          originalCreator,
          createdAt: originalCreatedAt,
        });
      }

      // 7d-2. User AI Token Sync & Storage
      if (url.pathname === '/api/user/ai-token' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const { username, encryptedApiKey, syncAiSettings } = body;
        const cleanUser = sanitizeUsername(username);
        if (!cleanUser) {
          return jsonResponse({ success: false, error: 'Username required' }, 400);
        }

        await patchFirestoreDoc(
          env,
          `users/${cleanUser}`,
          {
            encryptedApiKey: encryptedApiKey || null,
            syncAiSettings: !!syncAiSettings,
          },
          ['encryptedApiKey', 'syncAiSettings']
        );

        return jsonResponse({ success: true, synced: !!syncAiSettings });
      }

      // 7e. User AI Token Deletion (Permanently delete from database)
      if (url.pathname === '/api/user/ai-token/delete' || (url.pathname === '/api/user/ai-token' && request.method === 'DELETE')) {
        const body = request.method === 'POST' ? ((await request.json().catch(() => ({}))) as any) : {};
        const username = body?.username || url.searchParams.get('username') || '';
        const cleanUser = sanitizeUsername(username);
        if (!cleanUser) {
          return jsonResponse({ success: false, error: 'Username required' }, 400);
        }

        await patchFirestoreDoc(
          env,
          `users/${cleanUser}`,
          {
            encryptedApiKey: null,
            syncAiSettings: false,
          },
          ['encryptedApiKey', 'syncAiSettings']
        );

        return jsonResponse({ success: true, message: 'AI token permanently deleted from cloud database' });
      }

      // 8. Generate Quiz endpoint (Direct REST)
      if (url.pathname === '/api/generate-quiz' && request.method === 'POST') {
        const apiKey = env.GEMINI_API_KEY || (request.headers.get('Authorization') || '').replace('Bearer ', '');
        const body = (await request.json()) as any;
        const { topic, questionCount = 5, difficulty = 'Medium', quizStyle = 'General', context = '', withExplanations = true } = body;

        try {
          const parsedQuiz = await callGeminiGenerateQuiz(
            env,
            topic,
            questionCount,
            difficulty,
            quizStyle,
            context,
            withExplanations,
            apiKey
          );
          return jsonResponse({ success: true, data: parsedQuiz });
        } catch (err: any) {
          return jsonResponse({ error: 'Gemini Generation Failed', details: err.message }, 500);
        }
      }

      // 9. Summarize Results endpoint (Direct REST)
      if (url.pathname === '/api/summarize-results' && request.method === 'POST') {
        const apiKey = env.GEMINI_API_KEY || (request.headers.get('Authorization') || '').replace('Bearer ', '');
        const body = (await request.json()) as any;
        const { quizTitle, score, total, questions, userAnswers } = body;

        try {
          const responseText = await callGeminiSummarize(
            env,
            quizTitle,
            score,
            total,
            questions,
            userAnswers,
            apiKey
          );
          return jsonResponse({ success: true, data: responseText });
        } catch (err: any) {
          return jsonResponse({ error: 'Gemini Summary Failed', details: err.message }, 500);
        }
      }

      // 10. MCP (Model Context Protocol) Endpoint (JSON-RPC 2.0 & Discovery Gateway)
      if (url.pathname === '/api/mcp') {
        if (request.method === 'GET') {
          return jsonResponse({
            ok: true,
            service: 'MCQHub Model Context Protocol (MCP) Edge Server',
            version: '1.0.0',
            status: 'online',
            protocol: 'Model Context Protocol JSON-RPC 2.0',
            endpoint: 'https://mcqhub.adsbackend01.workers.dev/api/mcp',
            toolsCount: MCP_TOOLS_DEFINITIONS.length,
            tools: MCP_TOOLS_DEFINITIONS,
            clientSetup: {
              claudeDesktop: {
                command: 'node',
                args: ['mcp-server/index.mjs'],
              },
              cursor: {
                type: 'command',
                command: 'node ./mcp-server/index.mjs',
              },
              windsurf: {
                command: 'node',
                args: ['./mcp-server/index.mjs'],
              },
              antigravity: {
                server: 'mcqhub-mcp',
                type: 'stdio',
              },
            },
          });
        }

        if (request.method === 'POST') {
          const rpc = (await request.json()) as any;

          // Support batch JSON-RPC or single request
          const handleSingleRequest = async (req: any) => {
            const { id, method, params } = req;

            // MCP Handshake: initialize
            if (method === 'initialize') {
              return {
                jsonrpc: '2.0',
                id,
                result: {
                  protocolVersion: '2024-11-05',
                  capabilities: {
                    tools: {
                      listChanged: false,
                    },
                  },
                  serverInfo: {
                    name: 'mcqhub-mcp-server',
                    version: '1.0.0',
                  },
                },
              };
            }

            // MCP Notification: notifications/initialized
            if (method === 'notifications/initialized') {
              return null; // Notifications don't require responses in JSON-RPC
            }

            // MCP Ping
            if (method === 'ping') {
              return {
                jsonrpc: '2.0',
                id,
                result: {},
              };
            }

            // MCP tools/list
            if (method === 'tools/list') {
              return {
                jsonrpc: '2.0',
                id,
                result: {
                  tools: MCP_TOOLS_DEFINITIONS,
                },
              };
            }

            // MCP tools/call
            if (method === 'tools/call') {
              const toolName = params?.name;
              const toolArgs = params?.arguments || {};
              const authHeader = request.headers.get('Authorization') || undefined;

              try {
                const executionResult = await executeMcpTool(env, toolName, toolArgs, cfData, authHeader);
                return {
                  jsonrpc: '2.0',
                  id,
                  result: {
                    content: [
                      {
                        type: 'text',
                        text: typeof executionResult === 'string' ? executionResult : JSON.stringify(executionResult, null, 2),
                      },
                    ],
                    isError: false,
                  },
                };
              } catch (execErr: any) {
                return {
                  jsonrpc: '2.0',
                  id,
                  result: {
                    content: [
                      {
                        type: 'text',
                        text: `Error executing tool "${toolName}": ${execErr.message}`,
                      },
                    ],
                    isError: true,
                  },
                };
              }
            }

            // Unknown Method
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Method "${method}" not found on MCQHub MCP Server`,
              },
            };
          };

          if (Array.isArray(rpc)) {
            const results = (await Promise.all(rpc.map(handleSingleRequest))).filter(Boolean);
            return jsonResponse(results);
          } else {
            const singleResult = await handleSingleRequest(rpc);
            if (!singleResult) {
              return new Response(null, { status: 204, headers: CORS_HEADERS });
            }
            return jsonResponse(singleResult);
          }
        }
      }

      return new Response('MCQHub Worker Gateway Ready (Firestore Edge REST & MCP Active)', {
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message || 'Worker Internal Error' }, 500);
    }
  },
};
