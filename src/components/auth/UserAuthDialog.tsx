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
import { Switch } from '@/components/ui/switch';
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
  ShieldCheck,
  Lock,
} from 'lucide-react';
import {
  getUserSessionsFirestore,
  saveUserAiTokenFirestore,
  deleteUserAiTokenFirestore,
  fetchUserDataFirestore,
} from '@/lib/firestoreDb';
import { encryptToken } from '@/lib/crypto';
import type { UserSession } from '@/lib/types';

interface UserAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'auth' | 'sessions' | 'settings';
}

const STORAGE_API_KEY = 'mcqhub_gemini_api_key';
const STORAGE_SYNC_AI_SETTING = 'mcqhub_sync_ai_setting';

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
  const [syncToAccount, setSyncToAccount] = useState(false); // Off by default
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isDeletingCloudToken, setIsDeletingCloudToken] = useState(false);
  const [hasCloudSyncedKey, setHasCloudSyncedKey] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      if (user) {
        loadSessions(user.username);
        checkCloudAiToken(user.username);
      }
      try {
        const stored = localStorage.getItem(STORAGE_API_KEY);
        setSavedApiKey(stored);
        setApiKeyInput(stored || '');
        const storedSync = localStorage.getItem(STORAGE_SYNC_AI_SETTING);
        setSyncToAccount(storedSync === 'true');
      } catch {}
    }
  }, [open, defaultTab, user]);

  const checkCloudAiToken = async (uname: string) => {
    try {
      const data = await fetchUserDataFirestore(uname);
      if (data.success && data.encryptedApiKey) {
        setHasCloudSyncedKey(true);
        if (data.syncAiSettings) {
          setSyncToAccount(true);
        }
      } else {
        setHasCloudSyncedKey(false);
      }
    } catch {}
  };

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

  const handleToggleSync = (checked: boolean) => {
    if (checked && !user) {
      addToast('Sign in to sync your AI token across devices', 'info');
      return;
    }
    setSyncToAccount(checked);
    try {
      localStorage.setItem(STORAGE_SYNC_AI_SETTING, checked ? 'true' : 'false');
    } catch {}
  };

  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      addToast('Please enter an API key', 'error');
      return;
    }

    setIsSavingKey(true);
    try {
      // 1. Save locally to browser
      localStorage.setItem(STORAGE_API_KEY, trimmed);
      setSavedApiKey(trimmed);
      localStorage.setItem(STORAGE_SYNC_AI_SETTING, syncToAccount ? 'true' : 'false');

      // 2. If sync is enabled and user is authenticated, strictly encrypt before cloud storage
      if (syncToAccount && user) {
        const encrypted = await encryptToken(trimmed, user.username);
        const ok = await saveUserAiTokenFirestore(user.username, encrypted, true);
        if (ok) {
          setHasCloudSyncedKey(true);
          addToast('API key encrypted & synced across all your devices', 'success');
        } else {
          addToast('Saved locally, but could not sync to cloud database', 'info');
        }
      } else {
        addToast('Custom API key saved to browser local storage', 'success');
      }
    } catch (err: any) {
      addToast('Failed to save API key: ' + (err?.message || 'Error'), 'error');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDeleteCloudToken = async () => {
    if (!user) return;
    setIsDeletingCloudToken(true);
    try {
      const ok = await deleteUserAiTokenFirestore(user.username);
      if (ok) {
        setHasCloudSyncedKey(false);
        setSyncToAccount(false);
        try {
          localStorage.setItem(STORAGE_SYNC_AI_SETTING, 'false');
        } catch {}
        addToast('API token permanently deleted from cloud database', 'success');
      } else {
        addToast('Failed to delete token from cloud database', 'error');
      }
    } catch {
      addToast('Network error while deleting token from cloud database', 'error');
    } finally {
      setIsDeletingCloudToken(false);
    }
  };

  const handleClearApiKey = () => {
    try {
      localStorage.removeItem(STORAGE_API_KEY);
      setSavedApiKey(null);
      setApiKeyInput('');
      addToast('Custom API key removed from browser. Using default engine.', 'info');
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
                      Custom Key Active
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
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Google Gemini API Key</Label>
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>Get free key from Google AI Studio</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Enter your Gemini API key..."
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

                {/* Account Sync Toggle (OFF by default) */}
                <div className="pt-2 border-t border-border/50 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="sync-ai-toggle" className="text-xs font-medium cursor-pointer text-foreground">
                        Sync AI generation setting and token to your account
                      </Label>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Use the same API token across all your devices (mobile, laptop, and tablet). Tokens are strictly encrypted before cloud storage.
                      </p>
                    </div>
                    <Switch
                      id="sync-ai-toggle"
                      checked={syncToAccount}
                      onCheckedChange={handleToggleSync}
                      disabled={!user}
                      className="shrink-0"
                    />
                  </div>

                  {/* Conditional Privacy & Storage Status Notice */}
                  {!syncToAccount ? (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border border-border/60 text-[11px] text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Your token is stored in your browser local storage and not on our server.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20 text-[11px] text-primary">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span>End-to-end encrypted (AES-256-GCM). Synced across all your authorized devices.</span>
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    {user && hasCloudSyncedKey && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isDeletingCloudToken}
                        onClick={handleDeleteCloudToken}
                        className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30 px-2 gap-1"
                        title="Permanently remove your encrypted token from the cloud database"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{isDeletingCloudToken ? 'Deleting...' : 'Delete from Cloud Database'}</span>
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {savedApiKey && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearApiKey}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground px-2 gap-1"
                      >
                        Clear Local
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingKey}
                      onClick={handleSaveApiKey}
                      className="h-7 text-xs px-3 bg-primary text-primary-foreground font-medium"
                    >
                      {isSavingKey ? 'Saving...' : 'Save Key'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Informational Security & Handling Note */}
              <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>How custom AI tokens are handled</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
                  <p>
                    <strong className="text-foreground">Client-Side Isolation:</strong> By default, your API token is saved solely within your browser’s local storage and is never uploaded to our servers or databases.
                  </p>
                  <p>
                    <strong className="text-foreground">Strict Database Encryption:</strong> When you enable cross-device sync, your token is encrypted on your device using industry-standard AES-256-GCM before transmission. It remains encrypted at rest in Cloud Firestore and can only be decrypted by your authenticated sessions.
                  </p>
                  <p>
                    <strong className="text-foreground">Direct Edge Proxy:</strong> Requests proxy securely through Cloudflare Workers edge nodes directly to Google Gemini. Plaintext tokens are never logged or stored.
                  </p>
                  <p>
                    <strong className="text-foreground">Permanent Deletion:</strong> You have full control to clear your local token or permanently wipe it from the cloud database at any time.
                  </p>
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
