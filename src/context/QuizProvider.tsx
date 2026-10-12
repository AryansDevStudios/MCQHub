'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type {
  Quiz,
  Question,
  QuizAttempt,
  ViewState,
  Toast,
  UserProfile,
  UserSession,
  HeuristicStatus,
  ActiveExamSession,
} from '@/lib/types';
import {
  runFirestoreHeuristic,
  registerUserFirestore,
  loginUserFirestore,
  saveUserQuizzesFirestore,
  saveUserHistoryFirestore,
  fetchUserDataFirestore,
  saveActiveExamFirestore,
  fetchActiveExamFirestore,
  fetchServerTime,
} from '@/lib/firestoreDb';
import { createSharedQuizAction, getSharedQuizAction } from '@/lib/actions';
import { decryptToken } from '@/lib/crypto';

interface QuizContextType {
  // Navigation & Theme
  view: ViewState;
  setView: (view: ViewState) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // User & Firestore Auth
  user: UserProfile | null;
  activeSession: UserSession | null;
  isAuthLoading: boolean;
  login: (username: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, pass: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  syncToStorage: () => Promise<void>;

  // Two-way Smart Cloud Sync
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncLibraryWithCloud: (silent?: boolean, usernameOverride?: string) => Promise<void>;

  // Firebase Firestore Heuristic
  heuristicStatus: HeuristicStatus | null;
  isCheckingHeuristic: boolean;
  checkHeuristic: () => Promise<HeuristicStatus>;

  // Quiz Engine
  activeQuiz: Quiz | null;
  userAnswers: Record<number, number>;
  questionNotes: Record<number, string>;
  currentQuestionIndex: number;
  isInstantMode: boolean;
  setIsInstantMode: (val: boolean) => void;
  checkedQuestions: Record<number, boolean>;
  elapsedSeconds: number;
  elapsedMs: number;
  clockSkewMs: number;
  originDeviceId: string | null;
  isTimerRunning: boolean;

  // Live Cross-Device Active Exam Sync
  activeExamSession: ActiveExamSession | null;
  resumeActiveExam: () => void;
  discardActiveExam: () => void;

  // Quiz Actions
  startQuiz: (quiz: Quiz, instant?: boolean) => void;
  selectAnswer: (questionIndex: number, optionIndex: number) => void;
  checkAnswer: (questionIndex: number) => void;
  shuffleOptions: (questionIndex: number) => void;
  saveQuestionNote: (questionIndex: number, note: string) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  finishQuiz: () => void;
  retryQuiz: (quizOverride?: Quiz) => void;

  // Library & History
  savedQuizzes: Quiz[];
  saveQuizToLibrary: (quiz: Quiz) => void;
  deleteQuizFromLibrary: (indexOrTitle: string | number) => void;
  history: QuizAttempt[];
  clearHistory: () => void;
  deleteHistoryAttempt: (id: string) => void;
  viewAttemptResult: (attempt: QuizAttempt) => void;
  viewingAttempt: QuizAttempt | null;

  // JSON Buffer for editor tab
  editorJsonBuffer: string;
  setEditorJsonBuffer: (json: string) => void;

  // Toasts
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Share & Join Assessment functionality
  shareModalOpen: boolean;
  setShareModalOpen: (open: boolean) => void;
  activeShareData: { quiz: Quiz; shareId: string; shareUrl: string } | null;
  isSharing: boolean;
  openShareModal: (quiz: Quiz) => Promise<void>;
  pendingSharedQuiz: { shareId: string; quiz: Quiz; createdBy?: string; createdAt?: string } | null;
  isLoadingSharedQuiz: boolean;
  openSharedQuizById: (shareIdOrUrl: string) => Promise<boolean>;
  acceptPendingSharedQuiz: (startImmediately: boolean, saveToLib: boolean) => void;
  dismissPendingSharedQuiz: () => void;
  joinModalOpen: boolean;
  setJoinModalOpen: (open: boolean) => void;
}

const QuizContext = createContext<QuizContextType | null>(null);

const STORAGE_KEYS = {
  THEME: 'mcqhub_theme',
  USER: 'mcqhub_active_user',
  SESSION: 'mcqhub_active_session',
  LOCAL_QUIZZES: 'mcqhub_local_quizzes',
  LOCAL_HISTORY: 'mcqhub_local_history',
  DELETED_QUIZZES: 'mcqhub_deleted_quizzes',
  LAST_SYNC: 'mcqhub_last_sync',
  ACTIVE_EXAM: 'mcqhub_active_exam',
  API_KEY: 'mcqhub_gemini_api_key',
  SYNC_AI_SETTING: 'mcqhub_sync_ai_setting',
};

export const getPathForView = (v: ViewState): string => {
  switch (v) {
    case 'editor':
      return '/editor';
    case 'library':
      return '/library';
    case 'history':
      return '/history';
    case 'quiz':
      return '/quiz';
    case 'results':
      return '/results';
    case 'home':
    default:
      return '/';
  }
};

export const getViewForPath = (path: string): ViewState => {
  const clean = (path || '/').replace(/\/$/, '') || '/';
  if (clean === '/library') return 'library';
  if (clean === '/history') return 'history';
  if (clean === '/editor') return 'editor';
  if (clean === '/quiz') return 'quiz';
  if (clean === '/results') return 'results';
  return 'home';
};

export function QuizProvider({ children }: { children: React.ReactNode }) {
  // Sync view state directly from URL pathname on initial load
  const [view, setViewState] = useState<ViewState>(() => {
    if (typeof window !== 'undefined') {
      const pathView = getViewForPath(window.location.pathname);
      const cachedExam = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
      if (pathView === 'quiz' && cachedExam) return 'quiz';
      return pathView;
    }
    return 'home';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark' | null;
      if (savedTheme) return savedTheme;
    }
    return 'dark';
  });

  // Track attempt currently being viewed in ResultsView
  const [viewingAttempt, setViewingAttempt] = useState<QuizAttempt | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const rawHistory = localStorage.getItem(STORAGE_KEYS.LOCAL_HISTORY);
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
        }
      } catch {}
    }
    return null;
  });

  // Auth & Firestore state with instant local hydration
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.USER);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  });

  const [activeSession, setActiveSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  });

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [heuristicStatus, setHeuristicStatus] = useState<HeuristicStatus | null>(null);
  const [isCheckingHeuristic, setIsCheckingHeuristic] = useState<boolean>(false);

  // Synchronization status
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Collections (0ms instantaneous local hydration)
  const [savedQuizzes, setSavedQuizzes] = useState<Quiz[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_QUIZZES);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [];
  });

  const [history, setHistory] = useState<QuizAttempt[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_HISTORY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [];
  });

  // Active Exam state (instant local hydration so refresh retains 100% test progress)
  const [activeExamSession, setActiveExamSession] = useState<ActiveExamSession | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  });

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.quiz || null;
        }
      } catch {}
    }
    return null;
  });

  const [userAnswers, setUserAnswers] = useState<Record<number, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.userAnswers || {};
        }
      } catch {}
    }
    return {};
  });

  const [questionNotes, setQuestionNotes] = useState<Record<number, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.questionNotes || {};
        }
      } catch {}
    }
    return {};
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.currentQuestionIndex || 0;
        }
      } catch {}
    }
    return 0;
  });

  const [isInstantMode, setIsInstantModeState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
        if (raw) {
          const parsed = JSON.parse(raw);
          return !!parsed.isInstantMode;
        }
      } catch {}
    }
    return false;
  });

  const [checkedQuestions, setCheckedQuestions] = useState<Record<number, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.checkedQuestions || {};
        }
      } catch {}
    }
    return {};
  });

  const [elapsedMs, setElapsedMs] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.elapsedMs || (parsed.elapsedSeconds ? parsed.elapsedSeconds * 1000 : 0);
        }
      } catch {}
    }
    return 0;
  });

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
        if (raw) {
          const parsed = JSON.parse(raw);
          const ms = parsed.elapsedMs || (parsed.elapsedSeconds ? parsed.elapsedSeconds * 1000 : 0);
          return Math.floor(ms / 1000);
        }
      } catch {}
    }
    return 0;
  });

  const [clockSkewMs, setClockSkewMs] = useState<number>(0);
  const [originDeviceId, setOriginDeviceId] = useState<string | null>(null);

  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
        if (raw) {
          const parsed = JSON.parse(raw);
          return !!parsed.isTimerRunning;
        }
      } catch {}
    }
    return false;
  });

  const activeExamSessionRef = useRef<ActiveExamSession | null>(null);
  activeExamSessionRef.current = activeExamSession;
  const clockSkewRef = useRef<number>(0);

  // Device unique identifier helper
  const getOrCreateDeviceId = useCallback((): string => {
    if (typeof window === 'undefined') return 'server';
    let devId = localStorage.getItem('mcqhub_device_id');
    if (!devId) {
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      devId = `dev_${isMobile ? 'mobile' : 'laptop'}_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('mcqhub_device_id', devId);
    }
    return devId;
  }, []);

  // JSON editor buffer
  const [editorJsonBuffer, setEditorJsonBuffer] = useState<string>('');

  // Notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Share & Join Assessment functionality
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [activeShareData, setActiveShareData] = useState<{ quiz: Quiz; shareId: string; shareUrl: string } | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [pendingSharedQuiz, setPendingSharedQuiz] = useState<{
    shareId: string;
    quiz: Quiz;
    createdBy?: string;
    createdAt?: string;
  } | null>(null);
  const [isLoadingSharedQuiz, setIsLoadingSharedQuiz] = useState<boolean>(false);
  const [joinModalOpen, setJoinModalOpen] = useState<boolean>(false);

  // Refs for tracking synchronization state without re-render race conditions
  const userRef = useRef<UserProfile | null>(null);
  userRef.current = user;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocalUpdateRef = useRef<number>(0);
  const syncExamTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingExamRef = useRef<boolean>(false);

  // Toast utilities
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  /**
   * Immediately persist active exam state to localStorage and push to Cloud Firestore
   */
  const persistActiveExam = useCallback(
    (session: ActiveExamSession | null) => {
      lastLocalUpdateRef.current = Date.now();
      setActiveExamSession(session);

      if (typeof window !== 'undefined') {
        if (session) {
          localStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM, JSON.stringify(session));
        } else {
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_EXAM);
        }
      }

      // Batched cloud sync (debounced by 2500ms to strictly prevent flooding Firebase free quota)
      if (syncExamTimerRef.current) clearTimeout(syncExamTimerRef.current);
      syncExamTimerRef.current = setTimeout(async () => {
        const currentUser = userRef.current;
        if (currentUser && typeof navigator !== 'undefined' && navigator.onLine) {
          isSyncingExamRef.current = true;
          try {
            await saveActiveExamFirestore(currentUser.username, session);
          } catch (err: any) {
            console.warn('Active exam cloud push notice:', err?.message);
          } finally {
            isSyncingExamRef.current = false;
          }
        }
      }, 2500);
    },
    []
  );

  const setIsInstantMode = useCallback(
    (val: boolean) => {
      setIsInstantModeState(val);
      if (activeExamSessionRef.current) {
        const updated: ActiveExamSession = {
          ...activeExamSessionRef.current,
          isInstantMode: val,
          updatedAt: new Date().toISOString(),
        };
        activeExamSessionRef.current = updated;
        persistActiveExam(updated);
      }
    },
    [persistActiveExam]
  );

  /**
   * Smart Two-Way Reconciliation with Cloud Firestore
   */
  const syncLibraryWithCloud = useCallback(
    async (silent: boolean = false, usernameOverride?: string) => {
      const activeUsername = usernameOverride || user?.username;
      if (!activeUsername) return;

      setIsSyncing(true);

      try {
        const cloudRes = await fetchUserDataFirestore(activeUsername);
        if (!cloudRes.success) {
          if (!silent) addToast('Could not reach Firestore gateway; using local library cache', 'info');
          return;
        }

        const cloudQuizzes: Quiz[] = cloudRes.quizzes || [];
        const cloudHistory: QuizAttempt[] = cloudRes.history || [];

        // 1. Read locally recorded deletions
        let deletedQuizIds: Set<string> = new Set();
        try {
          const rawDeleted = localStorage.getItem(STORAGE_KEYS.DELETED_QUIZZES);
          if (rawDeleted) {
            deletedQuizIds = new Set(JSON.parse(rawDeleted));
          }
        } catch {}

        let currentLocalQuizzes: Quiz[] = [];
        try {
          const rawLocal = localStorage.getItem(STORAGE_KEYS.LOCAL_QUIZZES);
          if (rawLocal) currentLocalQuizzes = JSON.parse(rawLocal);
        } catch {
          currentLocalQuizzes = savedQuizzes;
        }

        // 2. Reconcile Quizzes
        const mergedQuizzesMap = new Map<string, Quiz>();
        for (const q of cloudQuizzes) {
          const id = q.id || q.title;
          const isDeleted = (q.id && deletedQuizIds.has(q.id)) || (!q.id && deletedQuizIds.has(q.title));
          if (!isDeleted) {
            mergedQuizzesMap.set(id, q);
          }
        }

        let needsCloudQuizUpdate = false;
        for (const localQ of currentLocalQuizzes) {
          const id = localQ.id || localQ.title;
          const isDeleted = (localQ.id && deletedQuizIds.has(localQ.id)) || (!localQ.id && deletedQuizIds.has(localQ.title));
          if (isDeleted) continue;
          if (!mergedQuizzesMap.has(id)) {
            mergedQuizzesMap.set(id, localQ);
            needsCloudQuizUpdate = true;
          }
        }
        const reconciledQuizzes = Array.from(mergedQuizzesMap.values());

        // 3. Reconcile History
        let currentLocalHistory: QuizAttempt[] = [];
        try {
          const rawHistory = localStorage.getItem(STORAGE_KEYS.LOCAL_HISTORY);
          if (rawHistory) currentLocalHistory = JSON.parse(rawHistory);
        } catch {
          currentLocalHistory = history;
        }

        const mergedHistoryMap = new Map<string, QuizAttempt>();
        for (const h of cloudHistory) {
          mergedHistoryMap.set(h.id, h);
        }
        let needsCloudHistoryUpdate = false;
        for (const h of currentLocalHistory) {
          if (!mergedHistoryMap.has(h.id)) {
            mergedHistoryMap.set(h.id, h);
            needsCloudHistoryUpdate = true;
          }
        }
        const reconciledHistory = Array.from(mergedHistoryMap.values());

        // 4. Update local state and localStorage
        setSavedQuizzes(reconciledQuizzes);
        localStorage.setItem(STORAGE_KEYS.LOCAL_QUIZZES, JSON.stringify(reconciledQuizzes));

        setHistory(reconciledHistory);
        localStorage.setItem(STORAGE_KEYS.LOCAL_HISTORY, JSON.stringify(reconciledHistory));

        // Reconcile Active Exam from Cloud
        if (cloudRes.activeExam) {
          const remoteTime = new Date(cloudRes.activeExam.updatedAt).getTime();
          if (remoteTime > lastLocalUpdateRef.current) {
            setActiveExamSession(cloudRes.activeExam);
            localStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM, JSON.stringify(cloudRes.activeExam));
          }
        }

        // Reconcile Encrypted AI Token (if account sync is active)
        if (cloudRes.syncAiSettings && cloudRes.encryptedApiKey) {
          try {
            const decryptedToken = await decryptToken(cloudRes.encryptedApiKey, activeUsername);
            if (decryptedToken) {
              localStorage.setItem(STORAGE_KEYS.API_KEY, decryptedToken);
              localStorage.setItem(STORAGE_KEYS.SYNC_AI_SETTING, 'true');
            }
          } catch (e) {
            console.warn('Failed to decrypt synced AI token:', e);
          }
        } else if (cloudRes.syncAiSettings === false && cloudRes.encryptedApiKey === null) {
          if (localStorage.getItem(STORAGE_KEYS.SYNC_AI_SETTING) === 'true') {
            localStorage.setItem(STORAGE_KEYS.SYNC_AI_SETTING, 'false');
          }
        }

        // 5. If local had new items or deletions, align Firestore in one update
        if (needsCloudQuizUpdate) {
          await saveUserQuizzesFirestore(activeUsername, reconciledQuizzes);
          localStorage.removeItem(STORAGE_KEYS.DELETED_QUIZZES);
        }
        if (needsCloudHistoryUpdate) {
          await saveUserHistoryFirestore(activeUsername, reconciledHistory);
        }

        const syncTimestamp = new Date().toISOString();
        setLastSyncTime(syncTimestamp);
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, syncTimestamp);

        if (!silent) {
          addToast(`Library aligned with cloud (${reconciledQuizzes.length} quizzes)`, 'success');
        }
      } catch (err: any) {
        console.warn('Sync with cloud failed:', err?.message);
        if (!silent) addToast('Sync notice: ' + (err?.message || 'Network unreachable'), 'info');
      } finally {
        setIsSyncing(false);
      }
    },
    [user, savedQuizzes, history, addToast]
  );

  // Navigation with browser URL deep-linking and smart cloud sync
  const setView = useCallback(
    (newView: ViewState) => {
      setViewState(newView);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('mcqhub_last_view', newView);
          const targetPath = getPathForView(newView);
          const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
          if (currentPath !== targetPath) {
            window.history.pushState({ view: newView }, '', targetPath + window.location.search);
          }
        } catch {}
      }
      if ((newView === 'library' || newView === 'history') && userRef.current) {
        syncLibraryWithCloud(true);
      }
    },
    [syncLibraryWithCloud]
  );

  // Handle browser Back / Forward navigation (PopState) and beforeunload timer snapshot
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const targetView = getViewForPath(window.location.pathname);
        setViewState(targetView);
        try {
          localStorage.setItem('mcqhub_last_view', targetView);
        } catch {}
        if ((targetView === 'library' || targetView === 'history') && userRef.current) {
          syncLibraryWithCloud(true);
        }
      }
    };

    // Save exact millisecond timer snapshot before page refresh or unload (0 cloud cost)
    const handleBeforeUnload = () => {
      const cur = activeExamSessionRef.current;
      if (cur && cur.isTimerRunning) {
        const nowEpoch = Date.now() + clockSkewRef.current;
        const startedAt = cur.startedAtMs || nowEpoch;
        const base = cur.baseElapsedMs || 0;
        const exactElapsed = Math.max(0, (nowEpoch - startedAt) + base);
        const snapshot: ActiveExamSession = {
          ...cur,
          elapsedMs: exactElapsed,
          elapsedSeconds: Math.floor(exactElapsed / 1000),
          updatedAt: new Date().toISOString(),
        };
        try {
          localStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM, JSON.stringify(snapshot));
        } catch {}
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 1. Initialize Theme, Local Storage, and Initial Alignment on Mount
  useEffect(() => {
    // Theme
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }

    // Local Storage Immediate Hydration
    let cachedUser: UserProfile | null = null;
    try {
      const cachedQuizzes = localStorage.getItem(STORAGE_KEYS.LOCAL_QUIZZES);
      if (cachedQuizzes) setSavedQuizzes(JSON.parse(cachedQuizzes));

      const cachedHistory = localStorage.getItem(STORAGE_KEYS.LOCAL_HISTORY);
      if (cachedHistory) setHistory(JSON.parse(cachedHistory));

      const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (rawUser) {
        cachedUser = JSON.parse(rawUser);
        setUser(cachedUser);
      }

      const cachedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (cachedSession) setActiveSession(JSON.parse(cachedSession));

      const cachedLastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      if (cachedLastSync) setLastSyncTime(cachedLastSync);

      // Hydrate Active In-Progress Exam from local storage
      const cachedActiveExam = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM);
      if (cachedActiveExam) {
        const parsed: ActiveExamSession = JSON.parse(cachedActiveExam);
        setActiveExamSession(parsed);

        const currentPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') || '/' : '/';

        // Only restore active quiz directly to quiz view if user navigated to or refreshed on /quiz
        if (currentPath === '/quiz') {
          setActiveQuiz(parsed.quiz);
          setUserAnswers(parsed.userAnswers || {});
          setCurrentQuestionIndex(parsed.currentQuestionIndex || 0);
          setCheckedQuestions(parsed.checkedQuestions || {});
          setQuestionNotes(parsed.questionNotes || {});
          setIsInstantMode(!!parsed.isInstantMode);

          const nowEpoch = Date.now() + clockSkewRef.current;
          const elapsed = parsed.elapsedMs || (parsed.elapsedSeconds ? parsed.elapsedSeconds * 1000 : 0);
          setElapsedMs(elapsed);
          setElapsedSeconds(Math.floor(elapsed / 1000));
          parsed.startedAtMs = nowEpoch - elapsed;
          parsed.baseElapsedMs = 0;
          parsed.isTimerRunning = true;
          activeExamSessionRef.current = parsed;
          setIsTimerRunning(true);
          setViewState('quiz');
        }
      }
    } catch (e) {
      console.warn('Error reading localStorage initial state:', e);
    }

    // Heuristic Check on start
    runInitialHeuristic();

    // Alignment Sync with Firestore on start (once per app refresh)
    if (cachedUser) {
      syncLibraryWithCloud(true, cachedUser.username);
    }

    // 4. Check for Shared Assessment in URL (?share=... or ?test=... or ?code=... or ?quiz=...)
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const shareParam = urlParams.get('share') || urlParams.get('test') || urlParams.get('code') || urlParams.get('quiz');
        if (shareParam) {
          setIsLoadingSharedQuiz(true);
          getSharedQuizAction(shareParam)
            .then((res) => {
              setIsLoadingSharedQuiz(false);
              if (res.success && res.quiz) {
                const originalCreator = res.createdBy || res.quiz.originalCreator || res.quiz.createdBy || 'Anonymous';
                const originalCreatedAt = res.createdAt || res.quiz.createdAt || new Date().toISOString();
                const loadedQuiz: Quiz = {
                  ...res.quiz,
                  shareId: res.shareId || shareParam,
                  originalCreator,
                  createdBy: originalCreator,
                  createdAt: originalCreatedAt,
                };

                const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
                if (currentPath === '/quiz') {
                  startQuiz(loadedQuiz, false);
                  addToast(`Started assessment #${res.shareId || shareParam}: "${res.quiz.title}"`, 'success');
                } else {
                  setPendingSharedQuiz({
                    shareId: res.shareId || shareParam,
                    quiz: loadedQuiz,
                    createdBy: originalCreator,
                    createdAt: originalCreatedAt,
                  });
                  addToast(`Shared Assessment loaded: "${res.quiz.title}"`, 'info');
                }

                // Clean share parameters from URL to prevent page reload from re-fetching and wiping in-progress exam
                if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
                  window.history.replaceState({}, document.title, window.location.pathname);
                }
              } else {
                addToast(res.error || 'Shared assessment link has expired', 'error');
              }
            })
            .catch((err) => {
              setIsLoadingSharedQuiz(false);
              console.warn('Failed to load shared quiz from URL:', err);
            });
        }
      }
    } catch (e) {
      console.warn('Error reading URL params:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Listen for Network Reconnect: Sync immediately when internet is restored
  useEffect(() => {
    const handleOnline = () => {
      if (user) {
        addToast('Internet connection restored. Syncing with cloud...', 'info');
        syncLibraryWithCloud(false);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, syncLibraryWithCloud, addToast]);

  // 3. Cross-Device Live Active Exam Sync (Only on Visibility Change / Tab Focus with 45s Cooldown)
  // Strictly protects Firebase free tier by eliminating high-frequency continuous polling
  useEffect(() => {
    if (!user) return;
    let lastPullTime = 0;

    const pullActiveExam = async () => {
      if (!userRef.current || isSyncingExamRef.current) return;
      const now = Date.now();
      if (now - lastPullTime < 45000) return; // Strict 45s cooldown
      lastPullTime = now;
      try {
        const res = await fetchActiveExamFirestore(userRef.current.username);
        if (res.clientSkewMs !== undefined) {
          clockSkewRef.current = res.clientSkewMs;
          setClockSkewMs(res.clientSkewMs);
        }

        const remote = res.activeExam;
        if (!remote) {
          if (activeExamSessionRef.current && Date.now() - lastLocalUpdateRef.current > 10000) {
            setActiveExamSession(null);
            activeExamSessionRef.current = null;
            if (activeQuiz) {
              setActiveQuiz(null);
              setIsTimerRunning(false);
              setElapsedMs(0);
              setElapsedSeconds(0);
              setOriginDeviceId(null);
            }
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_EXAM);
          }
          return;
        }

        const remoteTime = new Date(remote.updatedAt).getTime();
        if (remoteTime > lastLocalUpdateRef.current + 2000) {
          setActiveExamSession(remote);
          activeExamSessionRef.current = remote;
          if (remote.originDeviceId) setOriginDeviceId(remote.originDeviceId);
          localStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM, JSON.stringify(remote));

          if (activeQuiz && activeQuiz.title === remote.quiz.title) {
            setUserAnswers(remote.userAnswers || {});
            setCurrentQuestionIndex(remote.currentQuestionIndex || 0);
            setCheckedQuestions(remote.checkedQuestions || {});
            setQuestionNotes(remote.questionNotes || {});
          }
        }
      } catch {}
    };

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        pullActiveExam();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [user, activeQuiz]);

  const runInitialHeuristic = async () => {
    setIsCheckingHeuristic(true);
    try {
      const res = await runFirestoreHeuristic();
      setHeuristicStatus(res);
    } catch {
      // Handled cleanly
    } finally {
      setIsCheckingHeuristic(false);
    }
  };

  const checkHeuristic = async () => {
    setIsCheckingHeuristic(true);
    try {
      const res = await runFirestoreHeuristic();
      setHeuristicStatus(res);
      if (res.ok) {
        addToast(`Cloud Firestore verified (${res.latencyMs}ms)`, 'success');
      } else {
        addToast(`Firestore status: ${res.error || 'Setup required'}`, 'info');
      }
      return res;
    } catch (err: any) {
      const fallback: HeuristicStatus = {
        ok: false,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        bucket: 'Cloud Firestore (mcqhub-724e3)',
        error: err?.message || 'Firestore connection error',
      };
      setHeuristicStatus(fallback);
      return fallback;
    } finally {
      setIsCheckingHeuristic(false);
    }
  };

  // High-precision Millisecond Engine anchored to Origin Clock & Edge Master Clock
  useEffect(() => {
    if (!isTimerRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let lastSnapshotPersist = Date.now();
    const tick = () => {
      const currentSession = activeExamSessionRef.current;
      if (!currentSession || !currentSession.isTimerRunning) return;

      const nowEpoch = Date.now() + clockSkewRef.current;
      const startedAt = currentSession.startedAtMs || nowEpoch;
      const base = currentSession.baseElapsedMs || 0;
      const totalElapsed = Math.max(0, (nowEpoch - startedAt) + base);

      setElapsedMs(totalElapsed);
      setElapsedSeconds(Math.floor(totalElapsed / 1000));

      // Locally snapshot the exact second & millisecond to localStorage once every second (0 network requests, 0 cloud cost)
      if (Date.now() - lastSnapshotPersist > 1000) {
        lastSnapshotPersist = Date.now();
        currentSession.elapsedMs = totalElapsed;
        currentSession.elapsedSeconds = Math.floor(totalElapsed / 1000);
        try {
          localStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM, JSON.stringify(currentSession));
        } catch {}
      }
    };

    // Smooth 40ms interval (25 updates per second) for millisecond accuracy without browser throttling
    timerRef.current = setInterval(tick, 40);
    tick();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTimerRunning]);

  // Periodic Clock Calibration (Sync with Origin & Edge Master Clock every 30 seconds)
  useEffect(() => {
    const calibrateClock = async () => {
      try {
        const timeRes = await fetchServerTime();
        if (timeRes) {
          clockSkewRef.current = timeRes.clientSkewMs;
          setClockSkewMs(timeRes.clientSkewMs);
        }
      } catch {}
    };

    calibrateClock();
    const calibInterval = setInterval(calibrateClock, 30000);
    return () => clearInterval(calibInterval);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  // Auth Operations
  const login = async (username: string, pass: string) => {
    setIsAuthLoading(true);
    try {
      const result = await loginUserFirestore(username, pass);
      if (!result.success || !result.profile || !result.session) {
        addToast(result.error || 'Login failed', 'error');
        return { success: false, error: result.error };
      }

      setUser(result.profile);
      setActiveSession(result.session);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(result.profile));
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(result.session));

      // Restore active exam from cloud if present
      if (result.activeExam) {
        setActiveExamSession(result.activeExam);
        localStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM, JSON.stringify(result.activeExam));
      }

      // Trigger alignment sync immediately upon login
      await syncLibraryWithCloud(true, result.profile.username);

      addToast(`Welcome back, ${result.profile.displayName}!`, 'success');
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Login encountered an error';
      addToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      setIsAuthLoading(false);
    }
  };

  const register = async (username: string, pass: string, displayName?: string) => {
    setIsAuthLoading(true);
    try {
      const result = await registerUserFirestore(username, pass, displayName);
      if (!result.success || !result.profile || !result.session) {
        addToast(result.error || 'Registration failed', 'error');
        return { success: false, error: result.error };
      }

      setUser(result.profile);
      setActiveSession(result.session);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(result.profile));
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(result.session));

      addToast(`Account created! Logged in as ${result.profile.displayName}`, 'success');
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Registration encountered an error';
      addToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      setIsAuthLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setActiveSession(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    addToast('Logged out to Guest mode', 'info');
  };

  const syncToStorage = async () => {
    await syncLibraryWithCloud(false);
  };

  // Exam Management
  const startQuiz = (quiz: Quiz, instant: boolean = false) => {
    if (!quiz || !quiz.questions || quiz.questions.length === 0) {
      addToast('Invalid quiz format', 'error');
      return;
    }

    const cloned: Quiz = JSON.parse(JSON.stringify(quiz));
    setActiveQuiz(cloned);
    setUserAnswers({});
    setQuestionNotes({});
    setCheckedQuestions({});
    setCurrentQuestionIndex(0);
    setIsInstantMode(instant);
    setElapsedSeconds(0);
    setIsTimerRunning(true);
    setView('quiz');

    // Create and persist active exam session immediately
    const devId = getOrCreateDeviceId();
    const nowEpoch = Date.now() + clockSkewRef.current;

    const session: ActiveExamSession = {
      quiz: cloned,
      userAnswers: {},
      currentQuestionIndex: 0,
      elapsedSeconds: 0,
      elapsedMs: 0,
      startedAtMs: nowEpoch,
      baseElapsedMs: 0,
      originDeviceId: devId,
      isTimerRunning: true,
      isInstantMode: instant,
      checkedQuestions: {},
      questionNotes: {},
      updatedAt: new Date().toISOString(),
    };
    setOriginDeviceId(devId);
    setElapsedMs(0);
    setElapsedSeconds(0);
    setViewingAttempt(null);
    activeExamSessionRef.current = session;
    persistActiveExam(session);
  };

  /**
   * Resume active in-progress quiz from where you left off
   */
  const resumeActiveExam = () => {
    if (!activeExamSession) return;
    const nowEpoch = Date.now() + clockSkewRef.current;
    setActiveQuiz(activeExamSession.quiz);
    setUserAnswers(activeExamSession.userAnswers || {});
    setCurrentQuestionIndex(activeExamSession.currentQuestionIndex || 0);
    setIsInstantMode(!!activeExamSession.isInstantMode);
    setCheckedQuestions(activeExamSession.checkedQuestions || {});
    setQuestionNotes(activeExamSession.questionNotes || {});

    const base = activeExamSession.elapsedMs || (activeExamSession.elapsedSeconds ? activeExamSession.elapsedSeconds * 1000 : 0);
    setElapsedMs(base);
    setElapsedSeconds(Math.floor(base / 1000));
    setViewingAttempt(null);

    const updatedSession: ActiveExamSession = {
      ...activeExamSession,
      startedAtMs: nowEpoch,
      baseElapsedMs: base,
      originDeviceId: activeExamSession.originDeviceId || getOrCreateDeviceId(),
      isTimerRunning: true,
      updatedAt: new Date().toISOString(),
    };
    setOriginDeviceId(updatedSession.originDeviceId || null);
    activeExamSessionRef.current = updatedSession;
    persistActiveExam(updatedSession);
    setIsTimerRunning(true);
    setView('quiz');
    addToast(`Resumed "${activeExamSession.quiz.title}" at Question ${(activeExamSession.currentQuestionIndex || 0) + 1}`, 'info');
  };

  /**
   * Discard active in-progress quiz from both device and cloud
   */
  const discardActiveExam = () => {
    persistActiveExam(null);
    activeExamSessionRef.current = null;
    setActiveQuiz(null);
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setElapsedMs(0);
    setElapsedSeconds(0);
    setIsTimerRunning(false);
    setOriginDeviceId(null);
    setView('home');
    addToast('In-progress quiz discarded', 'info');
  };

  /**
   * Helper to build fully-anchored ActiveExamSession payload with millisecond epoch time
   */
  const buildActiveExamPayload = (
    overrides: {
      userAnswers?: Record<number, number>;
      currentQuestionIndex?: number;
      checkedQuestions?: Record<number, boolean>;
      questionNotes?: Record<number, string>;
      quiz?: Quiz;
    } = {}
  ): ActiveExamSession | null => {
    if (!activeQuiz) return null;
    const cur = activeExamSessionRef.current;
    const nowEpoch = Date.now() + clockSkewRef.current;

    return {
      quiz: overrides.quiz || activeQuiz,
      userAnswers: overrides.userAnswers !== undefined ? overrides.userAnswers : userAnswers,
      currentQuestionIndex: overrides.currentQuestionIndex !== undefined ? overrides.currentQuestionIndex : currentQuestionIndex,
      elapsedSeconds,
      elapsedMs,
      startedAtMs: cur?.startedAtMs || nowEpoch,
      baseElapsedMs: cur?.baseElapsedMs || 0,
      originDeviceId: cur?.originDeviceId || getOrCreateDeviceId(),
      isTimerRunning: true,
      isInstantMode,
      checkedQuestions: overrides.checkedQuestions !== undefined ? overrides.checkedQuestions : checkedQuestions,
      questionNotes: overrides.questionNotes !== undefined ? overrides.questionNotes : questionNotes,
      updatedAt: new Date().toISOString(),
    };
  };

  /**
   * Option Selection:
   * Immediate logging to the database as soon as an option is clicked,
   * without requiring Next or Submit.
   */
  const selectAnswer = (questionIndex: number, optionIndex: number) => {
    if (isInstantMode && checkedQuestions[questionIndex]) return;

    const updatedAnswers = {
      ...userAnswers,
      [questionIndex]: optionIndex,
    };
    setUserAnswers(updatedAnswers);

    if (activeQuiz) {
      const session = buildActiveExamPayload({
        userAnswers: updatedAnswers,
        currentQuestionIndex: questionIndex,
      });
      if (session) {
        activeExamSessionRef.current = session;
        persistActiveExam(session);
      }
    }
  };

  const checkAnswer = (questionIndex: number) => {
    if (userAnswers[questionIndex] === undefined) {
      addToast('Please choose an answer first', 'info');
      return;
    }
    const updatedChecked = {
      ...checkedQuestions,
      [questionIndex]: true,
    };
    setCheckedQuestions(updatedChecked);

    if (activeQuiz) {
      const session = buildActiveExamPayload({
        checkedQuestions: updatedChecked,
        currentQuestionIndex: questionIndex,
      });
      if (session) {
        activeExamSessionRef.current = session;
        persistActiveExam(session);
      }
    }
  };

  const shuffleOptions = (questionIndex: number) => {
    if (!activeQuiz) return;
    if (isInstantMode && checkedQuestions[questionIndex]) {
      addToast('Cannot shuffle after checking the answer', 'info');
      return;
    }

    const updatedQuiz = JSON.parse(JSON.stringify(activeQuiz)) as Quiz;
    const q = updatedQuiz.questions[questionIndex];
    if (!q || !q.options || q.options.length < 2) return;

    const originalCorrectOption = q.options[q.correctAnswer];

    // Fisher-Yates shuffle
    const shuffled = [...q.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    q.options = shuffled;
    q.correctAnswer = shuffled.indexOf(originalCorrectOption);
    updatedQuiz.questions[questionIndex] = q;

    setActiveQuiz(updatedQuiz);

    const updatedAnswers = { ...userAnswers };
    delete updatedAnswers[questionIndex];
    setUserAnswers(updatedAnswers);

    const session = buildActiveExamPayload({
      quiz: updatedQuiz,
      userAnswers: updatedAnswers,
      currentQuestionIndex: questionIndex,
    });
    if (session) {
      activeExamSessionRef.current = session;
      persistActiveExam(session);
    }

    addToast('Options randomized for Question ' + (questionIndex + 1), 'info');
  };

  const saveQuestionNote = (questionIndex: number, note: string) => {
    const updatedNotes = {
      ...questionNotes,
      [questionIndex]: note,
    };
    setQuestionNotes(updatedNotes);

    if (activeQuiz) {
      const session = buildActiveExamPayload({
        questionNotes: updatedNotes,
        currentQuestionIndex: questionIndex,
      });
      if (session) {
        activeExamSessionRef.current = session;
        persistActiveExam(session);
      }
    }
  };

  const goToQuestion = (index: number) => {
    if (activeQuiz && index >= 0 && index < activeQuiz.questions.length) {
      setCurrentQuestionIndex(index);
      const session = buildActiveExamPayload({ currentQuestionIndex: index });
      if (session) {
        activeExamSessionRef.current = session;
        persistActiveExam(session);
      }
    }
  };

  const nextQuestion = () => {
    if (activeQuiz && currentQuestionIndex < activeQuiz.questions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      const session = buildActiveExamPayload({ currentQuestionIndex: nextIdx });
      if (session) {
        activeExamSessionRef.current = session;
        persistActiveExam(session);
      }
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevIdx = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIdx);
      const session = buildActiveExamPayload({ currentQuestionIndex: prevIdx });
      if (session) {
        activeExamSessionRef.current = session;
        persistActiveExam(session);
      }
    }
  };

  const finishQuiz = () => {
    if (!activeQuiz) return;

    setIsTimerRunning(false);

    let score = 0;
    activeQuiz.questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) {
        score++;
      }
    });

    const totalMs = elapsedMs || (elapsedSeconds * 1000);
    const mins = Math.floor(totalMs / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const millis = Math.floor((totalMs % 1000) / 10);
    const timeSpent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;

    const attempt: QuizAttempt = {
      id: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString(),
      quizTitle: activeQuiz.title,
      score,
      total: activeQuiz.questions.length,
      timeSpent,
      mode: isInstantMode ? 'Instant' : 'Normal',
      quizData: JSON.parse(JSON.stringify(activeQuiz)),
      userAnswers: { ...userAnswers },
      questionNotes: { ...questionNotes },
    };

    const newHistory = [attempt, ...history];
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEYS.LOCAL_HISTORY, JSON.stringify(newHistory));
    setViewingAttempt(attempt);

    // Clear active in-progress exam from cloud and device!
    persistActiveExam(null);
    activeExamSessionRef.current = null;
    setActiveQuiz(null);
    setUserAnswers({});
    setCheckedQuestions({});
    setQuestionNotes({});
    setCurrentQuestionIndex(0);
    setElapsedMs(0);
    setElapsedSeconds(0);
    setOriginDeviceId(null);

    // If user is logged in, sync attempt to Firestore in background
    if (user && typeof navigator !== 'undefined' && navigator.onLine) {
      saveUserHistoryFirestore(user.username, newHistory).catch(() => {});
    }

    setView('results');
    addToast(`Exam completed! Score: ${score}/${attempt.total}`, 'success');
  };

  const retryQuiz = (quizOverride?: Quiz) => {
    const targetQuiz = quizOverride || activeQuiz || viewingAttempt?.quizData || history[0]?.quizData;
    if (!targetQuiz) {
      addToast('No quiz available to retake', 'info');
      return;
    }
    startQuiz(targetQuiz, isInstantMode);
  };

  // Immediate Local Persistence with Background Cloud Sync
  const saveQuizToLibrary = (quiz: Quiz) => {
    const toSave: Quiz = {
      ...JSON.parse(JSON.stringify(quiz)),
      id: quiz.id || `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: quiz.createdAt || new Date().toISOString(),
    };

    // 1. Instantly update local state & localStorage (0ms latency for the user)
    const updated = [
      toSave,
      ...savedQuizzes.filter((q) => (q.id && toSave.id ? q.id !== toSave.id : q.title !== toSave.title)),
    ];
    setSavedQuizzes(updated);
    localStorage.setItem(STORAGE_KEYS.LOCAL_QUIZZES, JSON.stringify(updated));

    // Remove from deleted list if re-added
    try {
      const rawDeleted = localStorage.getItem(STORAGE_KEYS.DELETED_QUIZZES);
      if (rawDeleted) {
        const deletedSet: Set<string> = new Set(JSON.parse(rawDeleted));
        if (toSave.id) deletedSet.delete(toSave.id);
        deletedSet.delete(toSave.title);
        localStorage.setItem(STORAGE_KEYS.DELETED_QUIZZES, JSON.stringify(Array.from(deletedSet)));
      }
    } catch {}

    // 2. Asynchronously sync to Cloud Firestore if logged in
    if (user && typeof navigator !== 'undefined' && navigator.onLine) {
      saveUserQuizzesFirestore(user.username, updated).catch((err) => {
        console.warn('Background save to Firestore failed (queued for next sync):', err?.message);
      });
    }

    addToast(`"${quiz.title}" saved to library`, 'success');
  };

  const deleteQuizFromLibrary = (indexOrTitle: string | number) => {
    let deletedItem: Quiz | undefined;
    const hasIdMatch = typeof indexOrTitle === 'string' && savedQuizzes.some((q) => q.id === indexOrTitle);

    const updated = savedQuizzes.filter((q, i) => {
      let isMatch = false;
      if (typeof indexOrTitle === 'number') {
        isMatch = i === indexOrTitle;
      } else if (hasIdMatch) {
        isMatch = q.id === indexOrTitle;
      } else {
        isMatch = q.id === indexOrTitle || q.title === indexOrTitle;
      }
      if (isMatch && !deletedItem) deletedItem = q;
      return !isMatch;
    });

    setSavedQuizzes(updated);
    localStorage.setItem(STORAGE_KEYS.LOCAL_QUIZZES, JSON.stringify(updated));

    // Record deletion so multi-device sync does not restore it
    if (deletedItem) {
      try {
        const rawDeleted = localStorage.getItem(STORAGE_KEYS.DELETED_QUIZZES);
        const deletedSet: Set<string> = new Set(rawDeleted ? JSON.parse(rawDeleted) : []);
        if (deletedItem.id) {
          deletedSet.add(deletedItem.id);
        } else {
          deletedSet.add(deletedItem.title);
        }
        localStorage.setItem(STORAGE_KEYS.DELETED_QUIZZES, JSON.stringify(Array.from(deletedSet)));
      } catch {}
    }

    // Push updated list to Firestore immediately if online
    if (user && typeof navigator !== 'undefined' && navigator.onLine) {
      saveUserQuizzesFirestore(user.username, updated).catch(() => {});
    }

    addToast('Quiz removed from library', 'info');
  };

  const deleteHistoryAttempt = (attemptId: string) => {
    const updated = history.filter((h) => h.id !== attemptId);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEYS.LOCAL_HISTORY, JSON.stringify(updated));

    if (user && typeof navigator !== 'undefined' && navigator.onLine) {
      saveUserHistoryFirestore(user.username, updated).catch(() => {});
    }

    addToast('Exam attempt removed from history', 'info');
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEYS.LOCAL_HISTORY);
    if (user && typeof navigator !== 'undefined' && navigator.onLine) {
      saveUserHistoryFirestore(user.username, []).catch(() => {});
    }
    addToast('Attempt history cleared', 'info');
  };

  const viewAttemptResult = (attempt: QuizAttempt) => {
    setActiveQuiz(attempt.quizData);
    setUserAnswers(attempt.userAnswers);
    setQuestionNotes(attempt.questionNotes || {});
    setViewingAttempt(attempt);
    setElapsedSeconds(0);
    setIsTimerRunning(false);
    setView('results');
  };

  // Share Assessment Operations
  const openShareModal = async (quiz: Quiz) => {
    if (!quiz || !quiz.title || !quiz.questions || quiz.questions.length === 0) {
      addToast('Cannot share an empty quiz', 'error');
      return;
    }

    setIsSharing(true);
    try {
      const origCreator = quiz.originalCreator || quiz.createdBy || user?.displayName || user?.username || 'Anonymous';
      const origCreatedAt = quiz.createdAt || new Date().toISOString();

      const quizToShare: Quiz = {
        ...quiz,
        shareId: quiz.shareId,
        originalCreator: origCreator,
        createdBy: origCreator,
        createdAt: origCreatedAt,
      };

      const res = await createSharedQuizAction(quizToShare, origCreator);
      if (res.success && res.shareId) {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mcqhub.web.app';
        const shareUrl = `${origin}/?share=${res.shareId}`;
        
        const finalQuiz: Quiz = {
          ...quizToShare,
          shareId: res.shareId,
          originalCreator: res.createdBy || origCreator,
          createdBy: res.createdBy || origCreator,
          createdAt: res.createdAt || origCreatedAt,
        };

        setActiveShareData({
          quiz: finalQuiz,
          shareId: res.shareId,
          shareUrl,
        });

        // Permanently attach the 5-digit shareId and original creator to this quiz in local library
        setSavedQuizzes((prev) => {
          const updated = prev.map((q) =>
            (q.id && q.id === quiz.id) || q.title === quiz.title
              ? {
                  ...q,
                  shareId: res.shareId,
                  originalCreator: finalQuiz.originalCreator,
                  createdBy: finalQuiz.createdBy,
                  createdAt: finalQuiz.createdAt,
                }
              : q
          );
          try {
            localStorage.setItem(STORAGE_KEYS.LOCAL_QUIZZES, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setShareModalOpen(true);
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            addToast(`Share Code ${res.shareId} & link copied to clipboard!`, 'success');
          }).catch(() => {
            addToast(`Share Code ${res.shareId} created successfully!`, 'success');
          });
        }
      } else {
        addToast(res.error || 'Failed to generate share link', 'error');
      }
    } catch (err: any) {
      addToast('Error sharing quiz: ' + err.message, 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const openSharedQuizById = async (shareIdOrUrl: string): Promise<boolean> => {
    let cleanId = shareIdOrUrl.trim();
    if (cleanId.includes('?share=')) {
      cleanId = cleanId.split('?share=')[1].split('&')[0].split('#')[0];
    } else if (cleanId.includes('?code=')) {
      cleanId = cleanId.split('?code=')[1].split('&')[0].split('#')[0];
    } else if (cleanId.includes('?test=')) {
      cleanId = cleanId.split('?test=')[1].split('&')[0].split('#')[0];
    } else if (cleanId.includes('?quiz=')) {
      cleanId = cleanId.split('?quiz=')[1].split('&')[0].split('#')[0];
    } else {
      const pinMatch = cleanId.match(/\b\d{5}\b/);
      if (pinMatch) {
        cleanId = pinMatch[0];
      }
    }
    cleanId = cleanId.replace(/[^a-zA-Z0-9_-]/g, '');

    if (!cleanId) {
      addToast('Please enter a valid 5-digit Share Code or Link', 'error');
      return false;
    }

    setIsLoadingSharedQuiz(true);
    try {
      const res = await getSharedQuizAction(cleanId);
      if (res.success && res.quiz) {
        const originalCreator = res.createdBy || res.quiz.originalCreator || res.quiz.createdBy || 'Anonymous';
        const originalCreatedAt = res.createdAt || res.quiz.createdAt || new Date().toISOString();

        const loadedQuiz: Quiz = {
          ...res.quiz,
          shareId: res.shareId || cleanId,
          originalCreator,
          createdBy: originalCreator,
          createdAt: originalCreatedAt,
        };

        setPendingSharedQuiz({
          shareId: res.shareId || cleanId,
          quiz: loadedQuiz,
          createdBy: originalCreator,
          createdAt: originalCreatedAt,
        });
        setJoinModalOpen(false);
        addToast(`Loaded assessment #${res.shareId || cleanId}: "${res.quiz.title}"`, 'success');
        return true;
      } else {
        addToast(res.error || 'Assessment not found. Please verify the 5-digit code.', 'error');
        return false;
      }
    } catch (err: any) {
      addToast('Error loading test: ' + err.message, 'error');
      return false;
    } finally {
      setIsLoadingSharedQuiz(false);
    }
  };

  const acceptPendingSharedQuiz = (startImmediately: boolean, saveToLib: boolean) => {
    if (!pendingSharedQuiz) return;
    const originalCreator = pendingSharedQuiz.createdBy || pendingSharedQuiz.quiz.originalCreator || pendingSharedQuiz.quiz.createdBy || 'Anonymous';
    const originalCreatedAt = pendingSharedQuiz.createdAt || pendingSharedQuiz.quiz.createdAt || new Date().toISOString();

    const targetQuiz: Quiz = {
      ...pendingSharedQuiz.quiz,
      shareId: pendingSharedQuiz.shareId,
      originalCreator,
      createdBy: originalCreator,
      createdAt: originalCreatedAt,
    };

    if (saveToLib) {
      saveQuizToLibrary(targetQuiz);
      addToast(`"${targetQuiz.title}" saved to your Library!`, 'success');
    }

    if (startImmediately) {
      startQuiz(targetQuiz, false);
      addToast(`Starting: "${targetQuiz.title}"`, 'info');
    }

    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    setPendingSharedQuiz(null);
  };

  const dismissPendingSharedQuiz = () => {
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setPendingSharedQuiz(null);
  };

  return (
    <QuizContext.Provider
      value={{
        view,
        setView,
        theme,
        toggleTheme,
        user,
        activeSession,
        isAuthLoading,
        login,
        register,
        logout,
        syncToStorage,
        isSyncing,
        lastSyncTime,
        syncLibraryWithCloud,
        heuristicStatus,
        isCheckingHeuristic,
        checkHeuristic,
        activeQuiz,
        userAnswers,
        questionNotes,
        currentQuestionIndex,
        isInstantMode,
        setIsInstantMode,
        checkedQuestions,
        elapsedSeconds,
        elapsedMs,
        clockSkewMs,
        originDeviceId,
        isTimerRunning,
        activeExamSession,
        resumeActiveExam,
        discardActiveExam,
        startQuiz,
        selectAnswer,
        checkAnswer,
        shuffleOptions,
        saveQuestionNote,
        goToQuestion,
        nextQuestion,
        prevQuestion,
        finishQuiz,
        retryQuiz,
        savedQuizzes,
        saveQuizToLibrary,
        deleteQuizFromLibrary,
        history,
        clearHistory,
        deleteHistoryAttempt,
        viewAttemptResult,
        viewingAttempt,
        editorJsonBuffer,
        setEditorJsonBuffer,
        toasts,
        addToast,
        removeToast,
        shareModalOpen,
        setShareModalOpen,
        activeShareData,
        isSharing,
        openShareModal,
        pendingSharedQuiz,
        isLoadingSharedQuiz,
        openSharedQuizById,
        acceptPendingSharedQuiz,
        dismissPendingSharedQuiz,
        joinModalOpen,
        setJoinModalOpen,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
}
