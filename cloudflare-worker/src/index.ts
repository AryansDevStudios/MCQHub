/**
 * MCQHub Cloudflare Worker Backend Handler
 * Features:
 * - Direct Firestore REST API integration (Bypasses browser ad-blockers & net::ERR_BLOCKED_BY_CLIENT)
 * - User Authentication (Register, Login, Token generation, Session audit)
 * - User Data Persistence (Quizzes library, History attempt logs)
 * - Edge AI proxy to Google Gemini 2.5 Flash Lite
 * - Heuristic system status and latency ping
 * - Model Context Protocol (MCP) JSON-RPC 2.0 gateway
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

function getFirestoreBaseUrl(env: Env): string {
  const projectId = env.FIREBASE_PROJECT_ID || 'mcqhub-724e3';
  const apiKey = env.FIREBASE_API_KEY || 'AIzaSyATzfV9pFDedahaiCwjrbELK9r21jKQ2As';
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

async function getFirestoreDoc(env: Env, path: string): Promise<any | null> {
  const apiKey = env.FIREBASE_API_KEY || 'AIzaSyATzfV9pFDedahaiCwjrbELK9r21jKQ2As';
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
  const apiKey = env.FIREBASE_API_KEY || 'AIzaSyATzfV9pFDedahaiCwjrbELK9r21jKQ2As';
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
            database: `projects/${env.FIREBASE_PROJECT_ID || 'mcqhub-724e3'}/databases/(default)`,
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

        // Check if user already exists
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

        // Update sessions and lastLogin in Firestore
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

      // 7b. User Data: Active Exam Sync (Cross-Device Live State with Millisecond Time Sync)
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

      // 7c. Share Quiz: Create Shareable Assessment in Firestore (5-Digit Code & Immutable Original Creator)
      if (url.pathname === '/api/share/create' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const { quiz, createdBy } = body;
        if (!quiz || !quiz.title || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
          return jsonResponse({ success: false, error: 'Valid quiz with questions is required' }, 400);
        }

        // Determine 5-digit numeric share ID
        let finalShareId: string | null = null;
        const providedShareId = (quiz.shareId || '').toString().trim();

        // 1. If this quiz was already shared or imported with a 5-digit code, reuse the exact existing one!
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

        // 2. Otherwise generate a clean 5-digit random numeric PIN (10000 - 99999)
        let attempts = 0;
        while (!finalShareId && attempts < 10) {
          const candidate = Math.floor(10000 + Math.random() * 90000).toString();
          const doc = await getFirestoreDoc(env, `shared_quizzes/${candidate}`);
          if (!doc) {
            finalShareId = candidate;
          }
          attempts++;
        }
        if (!finalShareId) {
          finalShareId = Math.floor(10000 + Math.random() * 90000).toString();
        }

        // Preserve the original creator and original creation timestamp
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
        // Extract 5-digit code or clean string
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

      // 7d. User AI Token Sync & Storage
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

      // 8. Generate Quiz endpoint
      if (url.pathname === '/api/generate-quiz' && request.method === 'POST') {
        const apiKey = env.GEMINI_API_KEY || (request.headers.get('Authorization') || '').replace('Bearer ', '');
        if (!apiKey) {
          return jsonResponse({ error: 'Missing GEMINI_API_KEY' }, 401);
        }

        const body = (await request.json()) as any;
        const { topic, questionCount = 5, difficulty = 'Medium', quizStyle = 'General', context = '', withExplanations = true } = body;

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

        const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiUrl, {
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

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          return jsonResponse({ error: 'Gemini API error', details: errText }, geminiRes.status);
        }

        const geminiData: any = await geminiRes.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsedQuiz = JSON.parse(responseText);

        return jsonResponse({ success: true, data: parsedQuiz });
      }

      // 9. Summarize Results endpoint
      if (url.pathname === '/api/summarize-results' && request.method === 'POST') {
        const apiKey = env.GEMINI_API_KEY || (request.headers.get('Authorization') || '').replace('Bearer ', '');
        if (!apiKey) {
          return jsonResponse({ error: 'Missing GEMINI_API_KEY' }, 401);
        }

        const body = (await request.json()) as any;
        const { quizTitle, score, total, questions, userAnswers } = body;

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

        const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
            },
          }),
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          return jsonResponse({ error: 'Gemini API error', details: errText }, geminiRes.status);
        }

        const geminiData: any = await geminiRes.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return jsonResponse({ success: true, data: responseText });
      }

      // 10. MCP (Model Context Protocol) Endpoint (JSON-RPC 2.0)
      if (url.pathname === '/api/mcp' && request.method === 'POST') {
        const rpc = (await request.json()) as any;
        const { id, method, params } = rpc;

        if (method === 'tools/list') {
          return jsonResponse({
            jsonrpc: '2.0',
            id,
            result: {
              tools: [
                {
                  name: 'generate_mcq_quiz',
                  description: 'Generate an interactive multiple-choice quiz with LaTeX and explanations',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      topic: { type: 'string', description: 'Subject or chapter topic' },
                      questionCount: { type: 'number', description: '1 to 30' },
                      difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
                      quizStyle: { type: 'string', enum: ['General', 'Conceptual', 'Problem Solving'] },
                    },
                    required: ['topic'],
                  },
                },
                {
                  name: 'get_system_heuristic',
                  description: 'Check MCQHub system status, edge latency, and health',
                  inputSchema: { type: 'object' },
                },
              ],
            },
          });
        }

        if (method === 'tools/call') {
          const toolName = params?.name;
          if (toolName === 'get_system_heuristic') {
            return jsonResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ status: 'healthy', mcpReady: true, timestamp: new Date().toISOString() }),
                  },
                ],
              },
            });
          }
        }

        return jsonResponse({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' },
        });
      }

      return new Response('MCQHub Worker Gateway Ready (Firestore Edge REST Active)', {
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message || 'Worker Internal Error' }, 500);
    }
  },
};
