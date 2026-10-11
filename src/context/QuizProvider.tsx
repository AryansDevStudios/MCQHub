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
} from '@/lib/firestoreDb';

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
  retryQuiz: () => void;

  // Library & History
  savedQuizzes: Quiz[];
  saveQuizToLibrary: (quiz: Quiz) => void;
  deleteQuizFromLibrary: (indexOrTitle: string | number) => void;
  history: QuizAttempt[];
  clearHistory: () => void;
  deleteHistoryAttempt: (id: string) => void;
  viewAttemptResult: (attempt: QuizAttempt) => void;

  // JSON Buffer for editor tab
  editorJsonBuffer: string;
  setEditorJsonBuffer: (json: string) => void;

  // Toasts
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
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
};

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [view, setViewState] = useState<ViewState>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Auth & Firestore state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeSession, setActiveSession] = useState<UserSession | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [heuristicStatus, setHeuristicStatus] = useState<HeuristicStatus | null>(null);
  const [isCheckingHeuristic, setIsCheckingHeuristic] = useState<boolean>(false);

  // Synchronization status
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Collections
  const [savedQuizzes, setSavedQuizzes] = useState<Quiz[]>([]);
  const [history, setHistory] = useState<QuizAttempt[]>([]);

  // Active Exam state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [questionNotes, setQuestionNotes] = useState<Record<number, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isInstantMode, setIsInstantMode] = useState<boolean>(false);
  const [checkedQuestions, setCheckedQuestions] = useState<Record<number, boolean>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // In-progress active exam session (persisted across devices)
  const [activeExamSession, setActiveExamSession] = useState<ActiveExamSession | null>(null);

  // JSON editor buffer
  const [editorJsonBuffer, setEditorJsonBuffer] = useState<string>('');

  // Notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

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

      // Fast cloud sync if user is signed in
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
      }, 150);
    },
    []
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
          if (!deletedQuizIds.has(id) && !deletedQuizIds.has(q.title)) {
            mergedQuizzesMap.set(id, q);
          }
        }

        let needsCloudQuizUpdate = false;
        for (const localQ of currentLocalQuizzes) {
          const id = localQ.id || localQ.title;
          if (deletedQuizIds.has(id) || deletedQuizIds.has(localQ.title)) continue;
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

  // Navigation with smart sync on opening library or history
  const setView = (newView: ViewState) => {
    setViewState(newView);
    if ((newView === 'library' || newView === 'history') && user) {
      syncLibraryWithCloud(true);
    }
  };

  // 1. Initialize Theme, Local Storage, and Initial Alignment on Mount
  useEffect(() => {
    // Theme
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      document.documentElement.classList.add('dark');
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

  // 3. Cross-Device Live Active Exam Sync Polling (every 3.5s & on window focus)
  useEffect(() => {
    if (!user) return;

    const pullActiveExam = async () => {
      if (!userRef.current || isSyncingExamRef.current) return;
      try {
        const remote = await fetchActiveExamFirestore(userRef.current.username);
        if (!remote) {
          // If remote was finished or discarded on another device
          if (activeExamSession && Date.now() - lastLocalUpdateRef.current > 4000) {
            setActiveExamSession(null);
            if (activeQuiz) {
              setActiveQuiz(null);
              setIsTimerRunning(false);
            }
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_EXAM);
          }
          return;
        }

        const remoteTime = new Date(remote.updatedAt).getTime();
        // If remote is newer than our local interaction by > 200ms, sync into view!
        if (remoteTime > lastLocalUpdateRef.current + 200) {
          setActiveExamSession(remote);
          localStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM, JSON.stringify(remote));

          // If the user has this quiz currently active on screen, live-update answers and progress!
          if (activeQuiz && activeQuiz.title === remote.quiz.title) {
            setUserAnswers(remote.userAnswers || {});
            setCurrentQuestionIndex(remote.currentQuestionIndex || 0);
            setCheckedQuestions(remote.checkedQuestions || {});
            setQuestionNotes(remote.questionNotes || {});
          }
        }
      } catch {}
    };

    const interval = setInterval(pullActiveExam, 3500);
    const handleFocus = () => pullActiveExam();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, activeQuiz, activeExamSession]);

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

  // Timer engine
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

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
    setViewState('quiz');

    // Create and persist active exam session immediately
    const session: ActiveExamSession = {
      quiz: cloned,
      userAnswers: {},
      currentQuestionIndex: 0,
      elapsedSeconds: 0,
      isInstantMode: instant,
      checkedQuestions: {},
      questionNotes: {},
      updatedAt: new Date().toISOString(),
    };
    persistActiveExam(session);
  };

  /**
   * Resume active in-progress quiz from where you left off
   */
  const resumeActiveExam = () => {
    if (!activeExamSession) return;
    setActiveQuiz(activeExamSession.quiz);
    setUserAnswers(activeExamSession.userAnswers || {});
    setCurrentQuestionIndex(activeExamSession.currentQuestionIndex || 0);
    setElapsedSeconds(activeExamSession.elapsedSeconds || 0);
    setIsInstantMode(!!activeExamSession.isInstantMode);
    setCheckedQuestions(activeExamSession.checkedQuestions || {});
    setQuestionNotes(activeExamSession.questionNotes || {});
    setIsTimerRunning(true);
    setViewState('quiz');
    addToast(`Resumed "${activeExamSession.quiz.title}" at Question ${(activeExamSession.currentQuestionIndex || 0) + 1}`, 'info');
  };

  /**
   * Discard active in-progress quiz from both device and cloud
   */
  const discardActiveExam = () => {
    persistActiveExam(null);
    setActiveQuiz(null);
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setIsTimerRunning(false);
    addToast('In-progress quiz discarded', 'info');
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
      const session: ActiveExamSession = {
        quiz: activeQuiz,
        userAnswers: updatedAnswers,
        currentQuestionIndex: questionIndex,
        elapsedSeconds,
        isInstantMode,
        checkedQuestions,
        questionNotes,
        updatedAt: new Date().toISOString(),
      };
      persistActiveExam(session);
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
      const session: ActiveExamSession = {
        quiz: activeQuiz,
        userAnswers,
        currentQuestionIndex: questionIndex,
        elapsedSeconds,
        isInstantMode,
        checkedQuestions: updatedChecked,
        questionNotes,
        updatedAt: new Date().toISOString(),
      };
      persistActiveExam(session);
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

    const session: ActiveExamSession = {
      quiz: updatedQuiz,
      userAnswers: updatedAnswers,
      currentQuestionIndex: questionIndex,
      elapsedSeconds,
      isInstantMode,
      checkedQuestions,
      questionNotes,
      updatedAt: new Date().toISOString(),
    };
    persistActiveExam(session);

    addToast('Options randomized for Question ' + (questionIndex + 1), 'info');
  };

  const saveQuestionNote = (questionIndex: number, note: string) => {
    const updatedNotes = {
      ...questionNotes,
      [questionIndex]: note,
    };
    setQuestionNotes(updatedNotes);

    if (activeQuiz) {
      const session: ActiveExamSession = {
        quiz: activeQuiz,
        userAnswers,
        currentQuestionIndex: questionIndex,
        elapsedSeconds,
        isInstantMode,
        checkedQuestions,
        questionNotes: updatedNotes,
        updatedAt: new Date().toISOString(),
      };
      persistActiveExam(session);
    }
  };

  const goToQuestion = (index: number) => {
    if (activeQuiz && index >= 0 && index < activeQuiz.questions.length) {
      setCurrentQuestionIndex(index);
      const session: ActiveExamSession = {
        quiz: activeQuiz,
        userAnswers,
        currentQuestionIndex: index,
        elapsedSeconds,
        isInstantMode,
        checkedQuestions,
        questionNotes,
        updatedAt: new Date().toISOString(),
      };
      persistActiveExam(session);
    }
  };

  const nextQuestion = () => {
    if (activeQuiz && currentQuestionIndex < activeQuiz.questions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      const session: ActiveExamSession = {
        quiz: activeQuiz,
        userAnswers,
        currentQuestionIndex: nextIdx,
        elapsedSeconds,
        isInstantMode,
        checkedQuestions,
        questionNotes,
        updatedAt: new Date().toISOString(),
      };
      persistActiveExam(session);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevIdx = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIdx);
      const session: ActiveExamSession = {
        quiz: activeQuiz,
        userAnswers,
        currentQuestionIndex: prevIdx,
        elapsedSeconds,
        isInstantMode,
        checkedQuestions,
        questionNotes,
        updatedAt: new Date().toISOString(),
      };
      persistActiveExam(session);
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

    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    const timeSpent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

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

    // Clear active in-progress exam from cloud and device!
    persistActiveExam(null);
    setActiveQuiz(null);
    setUserAnswers({});
    setCheckedQuestions({});
    setQuestionNotes({});
    setCurrentQuestionIndex(0);

    // If user is logged in, sync attempt to Firestore in background
    if (user && typeof navigator !== 'undefined' && navigator.onLine) {
      saveUserHistoryFirestore(user.username, newHistory).catch(() => {});
    }

    setViewState('results');
    addToast(`Exam completed! Score: ${score}/${attempt.total}`, 'success');
  };

  const retryQuiz = () => {
    if (!activeQuiz) return;
    setUserAnswers({});
    setCheckedQuestions({});
    setQuestionNotes({});
    setCurrentQuestionIndex(0);
    setElapsedSeconds(0);
    setIsTimerRunning(true);
    setViewState('quiz');

    const session: ActiveExamSession = {
      quiz: activeQuiz,
      userAnswers: {},
      currentQuestionIndex: 0,
      elapsedSeconds: 0,
      isInstantMode,
      checkedQuestions: {},
      questionNotes: {},
      updatedAt: new Date().toISOString(),
    };
    persistActiveExam(session);
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
    const updated = savedQuizzes.filter((q, i) => {
      const isMatch = typeof indexOrTitle === 'number'
        ? i === indexOrTitle
        : q.id === indexOrTitle || q.title === indexOrTitle;
      if (isMatch) deletedItem = q;
      return !isMatch;
    });

    setSavedQuizzes(updated);
    localStorage.setItem(STORAGE_KEYS.LOCAL_QUIZZES, JSON.stringify(updated));

    // Record deletion so multi-device sync does not restore it
    if (deletedItem) {
      try {
        const rawDeleted = localStorage.getItem(STORAGE_KEYS.DELETED_QUIZZES);
        const deletedSet: Set<string> = new Set(rawDeleted ? JSON.parse(rawDeleted) : []);
        if (deletedItem.id) deletedSet.add(deletedItem.id);
        deletedSet.add(deletedItem.title);
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
    setElapsedSeconds(0);
    setIsTimerRunning(false);
    setViewState('results');
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
        editorJsonBuffer,
        setEditorJsonBuffer,
        toasts,
        addToast,
        removeToast,
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
