'use client';

import React, { useState, useEffect } from 'react';
import { useQuiz } from '@/context/QuizProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  User,
  KeyRound,
  History,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Settings,
  Eye,
  EyeOff,
  Cloud,
  CheckCircle2,
  Trash2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { getUserSessionsFirestore } from '@/lib/firestoreDb';
import type { UserSession } from '@/lib/types';

interface UserAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'auth' | 'sessions' | 'settings';
}

const STORAGE_API_KEY = 'mcqhub_gemini_api_key';

export function UserAuthDialog({ open, onOpenChange, defaultTab = 'auth' }: UserAuthDialogProps) {
  const {
    user,
    isAuthLoading,
    login,
    register,
    logout,
    savedQuizzes,
    history,
    isSyncing,
    lastSyncTime,
    syncLibraryWithCloud,
    addToast,
  } = useQuiz();

  const [activeTab, setActiveTab] = useState<'auth' | 'sessions' | 'settings'>(defaultTab);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [sessionList, setSessionList] = useState<UserSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Custom API key state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      if (user) {
        loadSessions(user.username);
      }
      try {
        const stored = localStorage.getItem(STORAGE_API_KEY);
        setSavedApiKey(stored);
        setApiKeyInput(stored || '');
      } catch {}
    }
  }, [open, defaultTab, user]);

  const loadSessions = async (uname: string) => {
    setIsLoadingSessions(true);
    try {
      const list = await getUserSessionsFirestore(uname);
      setSessionList(list);
    } catch {
      setSessionList([]);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    if (authMode === 'login') {
      const res = await login(username.trim(), password);
      if (res.success) {
        setPassword('');
      }
    } else {
      const res = await register(username.trim(), password, displayName.trim());
      if (res.success) {
        setPassword('');
        setDisplayName('');
      }
    }
  };

  const copyToken = (tok: string) => {
    navigator.clipboard.writeText(tok);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      addToast('Please enter an API key', 'error');
      return;
    }
    try {
      localStorage.setItem(STORAGE_API_KEY, trimmed);
      setSavedApiKey(trimmed);
      addToast('Custom Google Gemini API key saved', 'success');
    } catch {
      addToast('Failed to save API key to local storage', 'error');
    }
  };

  const handleClearApiKey = () => {
    try {
      localStorage.removeItem(STORAGE_API_KEY);
      setSavedApiKey(null);
      setApiKeyInput('');
      addToast('Custom API key removed. Using standard engine.', 'info');
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md sm:max-w-lg max-h-[90vh] bg-card border-border text-foreground p-0 rounded-xl shadow-2xl flex flex-col overflow-hidden my-auto">
        
        {/* Header - Fixed with right padding to clear close button */}
        <DialogHeader className="px-4 sm:px-5 pt-4 pb-3 pr-12 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              {activeTab === 'settings' ? <Settings className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-semibold tracking-tight truncate">
                {user ? 'Account & Settings' : 'Sign In & Settings'}
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground truncate">
                {activeTab === 'settings' ? 'Configure personal API keys & cloud sync' : 'Sync your quizzes and history across devices'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Controls - Fixed under header */}
        <div className="px-4 sm:px-5 pt-3 pb-1 shrink-0">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
            <TabsList className="grid grid-cols-3 bg-muted/40 p-1 text-xs rounded-lg">
              <TabsTrigger value="auth" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs py-1.5 px-1 truncate">
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{user ? 'Account' : 'Sign In'}</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs py-1.5 px-1 truncate">
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Settings</span>
              </TabsTrigger>
              <TabsTrigger value="sessions" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs py-1.5 px-1 truncate" disabled={!user}>
                <History className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Devices</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Scrollable Tab Content Container */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-4 sm:px-5 py-3 space-y-4">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
            {/* TAB 1: AUTHENTICATION / ACCOUNT */}
            <TabsContent value="auth" className="space-y-4 focus-visible:outline-none m-0">
              {!user ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {authMode === 'login' ? 'Existing Account' : 'Create Free Account'}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant={authMode === 'login' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => setAuthMode('login')}
                      >
                        Sign In
                      </Button>
                      <Button
                        type="button"
                        variant={authMode === 'register' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => setAuthMode('register')}
                      >
                        Register
                      </Button>
                    </div>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Username</Label>
                      <Input
                        type="text"
                        placeholder="e.g. alex_learner"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="h-9 sm:h-8 text-xs bg-background"
                      />
                    </div>

                    {authMode === 'register' && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Display Name (Optional)</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Alex"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="h-9 sm:h-8 text-xs bg-background"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Password</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-9 sm:h-8 text-xs bg-background"
                      />
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Syncs quizzes seamlessly across devices.
                      </span>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isAuthLoading}
                        className="h-8 text-xs px-4 bg-primary text-primary-foreground font-medium shrink-0"
                      >
                        {isAuthLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {authMode === 'login' ? 'Sign In' : 'Create Account'}
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Logged in User Profile Card */}
                  <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center font-mono font-bold text-primary text-sm">
                          {user.displayName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-1.5">
                            {user.displayName}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">@{user.username}</div>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
                        Connected
                      </Badge>
                    </div>

                    {/* Records Summary */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded bg-background/50 border border-border/40">
                        <div className="text-muted-foreground text-[11px]">Saved Quizzes</div>
                        <div className="font-semibold text-sm font-mono mt-0.5">{savedQuizzes.length} saved</div>
                      </div>
                      <div className="p-2 rounded bg-background/50 border border-border/40">
                        <div className="text-muted-foreground text-[11px]">Quiz Attempts</div>
                        <div className="font-semibold text-sm font-mono mt-0.5">{history.length} completed</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSyncing}
                      onClick={() => syncLibraryWithCloud(false)}
                      className="h-8 text-xs gap-1.5 border-border/80"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Now'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={logout}
                      className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: SETTINGS (API KEY & PREFERENCES) */}
            <TabsContent value="settings" className="space-y-4 focus-visible:outline-none m-0">
              <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">AI Generation Settings</span>
                  </div>
                  {savedApiKey ? (
                    <Badge variant="outline" className="text-[11px] text-emerald-500 border-emerald-500/30 gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Custom Key
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] text-muted-foreground border-border">
                      Default Engine
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  MCQHub includes free built-in generation. If you prefer using your personal Google Gemini API key with higher limits, add it below:
                </p>

                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-medium">Google Gemini API Key</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="AIzaSy..."
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="h-9 sm:h-8 text-xs font-mono pr-8 bg-background"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span>Get a free key from Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <div className="flex gap-2 self-end sm:self-auto">
                    {savedApiKey && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearApiKey}
                        className="h-7 text-xs text-rose-500 hover:text-rose-600 px-2 gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveApiKey}
                      className="h-7 text-xs px-3 bg-primary text-primary-foreground font-medium"
                    >
                      Save Key
                    </Button>
                  </div>
                </div>
              </div>

              {/* Cloud Sync Status Card */}
              <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Cloud Sync & Storage</span>
                  </div>
                  <Badge variant="outline" className="text-[11px] text-primary border-primary/30">
                    {user ? 'Auto-sync active' : 'Local storage only'}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {user
                    ? 'Your custom quizzes and test history automatically synchronize across your laptop, phone, and tablet.'
                    : 'Sign in to sync your questions and test scores across your devices.'}
                </p>

                {user && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <span className="text-muted-foreground text-[11px]">
                      {lastSyncTime ? `Last synced: ${new Date(lastSyncTime).toLocaleTimeString()}` : 'Ready to sync'}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSyncing}
                      onClick={() => syncLibraryWithCloud(false)}
                      className="h-7 text-xs gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: SESSIONS */}
            <TabsContent value="sessions" className="space-y-3 focus-visible:outline-none m-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Active login sessions:
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => user && loadSessions(user.username)}
                  className="h-6 px-2 text-[11px] gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </Button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {isLoadingSessions ? (
                  <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    Loading devices...
                  </div>
                ) : sessionList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No active sessions recorded.
                  </div>
                ) : (
                  sessionList.map((s, idx) => (
                    <div
                      key={s.tokenId || idx}
                      className="p-2.5 rounded border border-border/60 bg-muted/20 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-primary truncate max-w-[180px]">
                          {s.tokenId}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            idx === 0
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] py-0'
                              : 'text-[10px] py-0 text-muted-foreground'
                          }
                        >
                          {idx === 0 ? 'Current Device' : 'Other Device'}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex justify-between">
                        <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                        <span className="truncate max-w-[120px] text-[10px]">{s.userAgent}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
