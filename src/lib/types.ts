export interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface Quiz {
  id?: string;
  title: string;
  questions: Question[];
  createdAt?: string;
}

export interface QuizAttempt {
  id: string;
  date: string;
  quizTitle: string;
  score: number;
  total: number;
  timeSpent: string; // MM:SS
  mode: 'Instant' | 'Normal';
  quizData: Quiz;
  userAnswers: Record<number, number>; // index -> optionIndex
  questionNotes: Record<number, string>;
}

export type ViewState = 'home' | 'editor' | 'quiz' | 'results' | 'library' | 'history';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface UserProfile {
  userId: string;
  username: string;
  displayName: string;
  createdAt: string;
  lastLogin: string;
}

export interface UserSession {
  tokenId: string;
  timestamp: string;
  userAgent: string;
  status: string;
}

export interface HeuristicStatus {
  ok: boolean;
  latencyMs: number;
  timestamp: string;
  bucket: string;
  message?: string;
  error?: string;
}
