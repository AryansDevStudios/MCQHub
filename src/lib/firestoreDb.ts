import type { UserProfile, UserSession, Quiz, QuizAttempt, HeuristicStatus } from './types';

export function sanitizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL || 'https://mcqhub.adsbackend01.workers.dev';

// Local cache keys for offline / guest fallback
const LOCAL_STORE_KEY = (user: string) => `mcqhub_fs_cache_${user}`;

function getLocalUserBackup(cleanUser: string): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY(cleanUser));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalUserBackup(cleanUser: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORE_KEY(cleanUser), JSON.stringify(data));
  } catch {}
}

/**
 * Heuristic ping request for Cloud Firestore via Edge Worker
 * (Immune to browser ad-blockers and net::ERR_BLOCKED_BY_CLIENT)
 */
export async function runFirestoreHeuristic(): Promise<HeuristicStatus> {
  const startTime = performance.now();
  const pingTimestamp = new Date().toISOString();

  try {
    const res = await fetch(`${CF_WORKER_URL}/api/heuristic`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (res.ok) {
      const data = await res.json();
      const fsOk = data.firestore?.ok ?? data.ok;
      return {
        ok: fsOk,
        latencyMs: data.firestore?.latencyMs || latencyMs,
        timestamp: data.timestamp || pingTimestamp,
        bucket: `Cloud Firestore [Edge ${data.edgeColo || 'SIN'}]`,
        message: fsOk
          ? `Firestore Verified via Cloudflare Edge (${latencyMs}ms)`
          : `Firestore notice: ${data.firestore?.error || 'Database unavailable'}`,
        error: fsOk ? undefined : data.firestore?.error,
      };
    } else {
      return {
        ok: false,
        latencyMs,
        timestamp: pingTimestamp,
        bucket: 'Cloud Firestore (mcqhub-724e3)',
        error: `Edge Gateway responded with HTTP ${res.status}`,
      };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      latencyMs,
      timestamp: pingTimestamp,
      bucket: 'Cloud Firestore (mcqhub-724e3)',
      error: err?.message || 'Network unreachable',
    };
  }
}

/**
 * Register user in Cloud Firestore via Edge Worker
 */
export async function registerUserFirestore(
  username: string,
  pass: string,
  displayName?: string
): Promise<{ success: boolean; profile?: UserProfile; session?: UserSession; error?: string }> {
  const cleanUser = sanitizeUsername(username);
  if (!cleanUser || cleanUser.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters' };
  }
  if (!pass || pass.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' };
  }

  try {
    const res = await fetch(`${CF_WORKER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUser,
        password: pass,
        displayName: displayName?.trim() || cleanUser,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Registration failed' };
    }

    setLocalUserBackup(cleanUser, {
      ...data.profile,
      sessions: [data.session],
      quizzes: [],
      history: [],
    });

    return { success: true, profile: data.profile, session: data.session };
  } catch (err: any) {
    // Local offline fallback
    console.warn('Edge Worker unreachable during registration, checking local cache:', err?.message);
    const backup = getLocalUserBackup(cleanUser);
    if (backup) {
      return { success: false, error: 'Username already registered in offline cache.' };
    }

    const now = new Date().toISOString();
    const fallbackProfile: UserProfile = {
      userId: `usr_${cleanUser}_${Math.random().toString(36).substring(2, 7)}`,
      username: cleanUser,
      displayName: displayName?.trim() || cleanUser,
      createdAt: now,
      lastLogin: now,
    };
    const fallbackSession: UserSession = {
      tokenId: `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`,
      timestamp: now,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
      status: 'active',
    };

    setLocalUserBackup(cleanUser, {
      ...fallbackProfile,
      sessions: [fallbackSession],
      quizzes: [],
      history: [],
    });

    return { success: true, profile: fallbackProfile, session: fallbackSession };
  }
}

/**
 * Log in an existing user from Cloud Firestore via Edge Worker
 */
export async function loginUserFirestore(
  username: string,
  pass: string
): Promise<{
  success: boolean;
  profile?: UserProfile;
  session?: UserSession;
  quizzes?: Quiz[];
  history?: QuizAttempt[];
  error?: string;
}> {
  const cleanUser = sanitizeUsername(username);

  try {
    const res = await fetch(`${CF_WORKER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUser,
        password: pass,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Authentication failed' };
    }

    // Keep local cache in sync
    setLocalUserBackup(cleanUser, {
      ...data.profile,
      sessions: data.session ? [data.session] : [],
      quizzes: data.quizzes || [],
      history: data.history || [],
    });

    return {
      success: true,
      profile: data.profile,
      session: data.session,
      quizzes: data.quizzes || [],
      history: data.history || [],
    };
  } catch (err: any) {
    // Offline local cache fallback
    console.warn('Edge Worker unreachable during login, attempting local fallback:', err?.message);
    const backup = getLocalUserBackup(cleanUser);
    if (backup) {
      const now = new Date().toISOString();
      const localSession: UserSession = {
        tokenId: `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`,
        timestamp: now,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
        status: 'active',
      };
      return {
        success: true,
        profile: {
          userId: backup.userId,
          username: backup.username,
          displayName: backup.displayName,
          createdAt: backup.createdAt,
          lastLogin: now,
        },
        session: localSession,
        quizzes: backup.quizzes || [],
        history: backup.history || [],
      };
    }
    return { success: false, error: 'Cannot connect to authentication service.' };
  }
}

/**
 * Fetch sessions history from Cloud Firestore via Edge Worker
 */
export async function getUserSessionsFirestore(username: string): Promise<UserSession[]> {
  const cleanUser = sanitizeUsername(username);
  try {
    const res = await fetch(`${CF_WORKER_URL}/api/auth/sessions?username=${encodeURIComponent(cleanUser)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        return data.sessions;
      }
    }
  } catch {}

  const backup = getLocalUserBackup(cleanUser);
  return backup?.sessions || [];
}

/**
 * Save user quizzes to Cloud Firestore via Edge Worker
 */
export async function saveUserQuizzesFirestore(username: string, quizzes: Quiz[]): Promise<boolean> {
  const cleanUser = sanitizeUsername(username);

  const backup = getLocalUserBackup(cleanUser) || {};
  backup.quizzes = quizzes;
  setLocalUserBackup(cleanUser, backup);

  try {
    const res = await fetch(`${CF_WORKER_URL}/api/user/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUser,
        quizzes,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Save user exam attempts to Cloud Firestore via Edge Worker
 */
export async function saveUserHistoryFirestore(username: string, history: QuizAttempt[]): Promise<boolean> {
  const cleanUser = sanitizeUsername(username);

  const backup = getLocalUserBackup(cleanUser) || {};
  backup.history = history;
  setLocalUserBackup(cleanUser, backup);

  try {
    const res = await fetch(`${CF_WORKER_URL}/api/user/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUser,
        history,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch complete user profile, quizzes, and history from Cloud Firestore via Edge Worker
 */
export async function fetchUserDataFirestore(username: string): Promise<{
  success: boolean;
  quizzes?: Quiz[];
  history?: QuizAttempt[];
  sessions?: UserSession[];
  profile?: UserProfile;
  error?: string;
}> {
  const cleanUser = sanitizeUsername(username);
  try {
    const res = await fetch(`${CF_WORKER_URL}/api/user/data?username=${encodeURIComponent(cleanUser)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          quizzes: Array.isArray(data.quizzes) ? data.quizzes : [],
          history: Array.isArray(data.history) ? data.history : [],
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          profile: data.profile,
        };
      }
    }
  } catch (err: any) {
    console.warn('Failed to fetch user data from edge worker:', err?.message);
  }

  // Local fallback
  const backup = getLocalUserBackup(cleanUser);
  if (backup) {
    return {
      success: true,
      quizzes: backup.quizzes || [],
      history: backup.history || [],
      sessions: backup.sessions || [],
      profile: backup,
    };
  }

  return { success: false, error: 'Could not fetch user data' };
}
