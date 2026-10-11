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
} from '@/lib/types';
import {
  runFirestoreHeuristic,
  registerUserFirestore,
  loginUserFirestore,
  saveUserQuizzesFirestore,
  saveUserHistoryFirestore,
  fetchUserDataFirestore,
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

  // JSON editor buffer
  const [editorJsonBuffer, setEditorJsonBuffer] = useState<string>('');

  // Notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Timer interval ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
   * Smart Two-Way Reconciliation with Cloud Firestore
   * - Aligns local storage & Firestore on app refresh / network reconnect / library tab click.
   * - Preserves locally generated offline tests and pushes them to Firestore.
   * - Pulls new tests added from other devices (mobile, laptop).
   * - Does NOT poll constantly in the background.
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

        // Read current local quizzes from storage for most accurate snapshot
        let currentLocalQuizzes: Quiz[] = [];
        try {
          const rawLocal = localStorage.getItem(STORAGE_KEYS.LOCAL_QUIZZES);
          if (rawLocal) currentLocalQuizzes = JSON.parse(rawLocal);
        } catch {
          currentLocalQuizzes = savedQuizzes;
        }

        // 2. Reconcile Quizzes
        const mergedQuizzesMap = new Map<string, Quiz>();

        // Add valid cloud quizzes
        for (const q of cloudQuizzes) {
          const key = q.id || q.title;
          if (!deletedQuizIds.has(key) && !deletedQuizIds.has(q.title)) {
            mergedQuizzesMap.set(key, q);
          }
        }

        // Merge local quizzes (pulling in any generated offline or pending upload)
        let needsCloudQuizUpdate = false;
        for (const q of currentLocalQuizzes) {
          const key = q.id || q.title;
          if (deletedQuizIds.has(key) || deletedQuizIds.has(q.title)) {
            continue;
          }
          if (!mergedQuizzesMap.has(key)) {
            // Local has a quiz that Firestore is missing!
            mergedQuizzesMap.set(key, q);
            needsCloudQuizUpdate = true;
          } else {
            // If both have it, keep the one with questions or newest timestamp
            const existing = mergedQuizzesMap.get(key)!;
            if (
              (!existing.questions || existing.questions.length === 0) &&
              (q.questions && q.questions.length > 0)
            ) {
              mergedQuizzesMap.set(key, q);
              needsCloudQuizUpdate = true;
            }
          }
        }

        // If items were deleted, Cloud needs to be updated
        if (deletedQuizIds.size > 0) {
          needsCloudQuizUpdate = true;
        }

        const reconciledQuizzes = Array.from(mergedQuizzesMap.values());

        // 3. Reconcile History
        let currentLocalHistory: QuizAttempt[] = [];
        try {
          const rawHist = localStorage.getItem(STORAGE_KEYS.LOCAL_HISTORY);
          if (rawHist) currentLocalHistory = JSON.parse(rawHist);
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
          addToast(`Library aligned with Cloud Firestore (${reconciledQuizzes.length} tests)`, 'success');
        }
      } catch (err: any) {
        console.warn('Sync with cloud failed:', err?.message);
        if (!silent) addToast('Sync failed: ' + (err?.message || 'Network error'), 'error');
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
      // Fetch and align once upon opening the tab
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
    } catch (e) {
      console.warn('Error reading localStorage initial state:', e);
    }

    // Single Heuristic Check on start
    runInitialHeuristic();

    // Single Alignment Sync with Firestore on start (once per app refresh)
    if (cachedUser) {
      syncLibraryWithCloud(true, cachedUser.username);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Listen for Network Reconnect: Sync immediately when internet is restored
  useEffect(() => {
    const handleOnline = () => {
      if (user) {
        addToast('Internet connection restored. Aligning library with Firestore...', 'info');
        syncLibraryWithCloud(false);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, syncLibraryWithCloud, addToast]);

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

      // If user had local quizzes generated prior to registering, sync them to the new account!
      if (savedQuizzes.length > 0) {
        await saveUserQuizzesFirestore(result.profile.username, savedQuizzes);
      }

      addToast(`Account created for ${result.profile.displayName}`, 'success');
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
  };

  const selectAnswer = (questionIndex: number, optionIndex: number) => {
    if (isInstantMode && checkedQuestions[questionIndex]) return;

    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const checkAnswer = (questionIndex: number) => {
    if (userAnswers[questionIndex] === undefined) {
      addToast('Please choose an answer first', 'info');
      return;
    }
    setCheckedQuestions((prev) => ({
      ...prev,
      [questionIndex]: true,
    }));
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

    setUserAnswers((prev) => {
      const copy = { ...prev };
      delete copy[questionIndex];
      return copy;
    });

    addToast('Options randomized for Question ' + (questionIndex + 1), 'info');
  };

  const saveQuestionNote = (questionIndex: number, note: string) => {
    setQuestionNotes((prev) => ({
      ...prev,
      [questionIndex]: note,
    }));
  };

  const goToQuestion = (index: number) => {
    if (activeQuiz && index >= 0 && index < activeQuiz.questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  const nextQuestion = () => {
    if (activeQuiz && currentQuestionIndex < activeQuiz.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
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

    // If user is logged in, sync attempt to Firestore in background
    if (user && typeof navigator !== 'undefined' && navigator.onLine) {
      saveUserHistoryFirestore(user.username, newHistory).catch(() => {});
    }

    setViewState('results');
    addToast(`Exam completed! Score: ${score}/${activeQuiz.questions.length}`, 'success');
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
