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
  Bot,
  Globe,
} from 'lucide-react';
import {
  getUserSessionsFirestore,
  saveUserAiTokenFirestore,
  deleteUserAiTokenFirestore,
  fetchUserDataFirestore,
  getUserMcpTokenFirestore,
  rotateUserMcpTokenFirestore,
} from '@/lib/firestoreDb';
import { encryptToken } from '@/lib/crypto';
import type { UserSession } from '@/lib/types';

interface UserAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'auth' | 'sessions' | 'settings' | 'mcp';
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

  const [activeTab, setActiveTab] = useState<'auth' | 'sessions' | 'settings' | 'mcp'>(defaultTab);
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

  // MCP Secret Link state
  const [mcpToken, setMcpToken] = useState<string | null>(null);
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);
  const [isLoadingMcp, setIsLoadingMcp] = useState(false);
  const [isRotatingMcp, setIsRotatingMcp] = useState(false);
  const [copiedMcpUrl, setCopiedMcpUrl] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [selectedClient, setSelectedClient] = useState<'cursor' | 'claude' | 'windsurf'>('cursor');

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      if (user) {
        loadSessions(user.username);
        checkCloudAiToken(user.username);
        loadMcpInfo(user.username);
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

  const loadMcpInfo = async (uname: string) => {
    setIsLoadingMcp(true);
    try {
      const res = await getUserMcpTokenFirestore(uname);
      if (res.success && res.mcpToken && res.mcpUrl) {
        setMcpToken(res.mcpToken);
        setMcpUrl(res.mcpUrl);
      }
    } catch (err) {
      console.warn('Failed to load MCP info:', err);
    } finally {
      setIsLoadingMcp(false);
    }
  };

  const handleRotateMcpToken = async () => {
    if (!user) return;
    setIsRotatingMcp(true);
    try {
      const res = await rotateUserMcpTokenFirestore(user.username);
      if (res.success && res.mcpToken && res.mcpUrl) {
        setMcpToken(res.mcpToken);
        setMcpUrl(res.mcpUrl);
        addToast('New secret MCP link generated! Old link revoked.', 'success');
      } else {
        addToast('Failed to regenerate MCP link', 'error');
      }
    } catch {
      addToast('Network error while generating MCP link', 'error');
    } finally {
      setIsRotatingMcp(false);
    }
  };

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

  const getClientConfigSnippet = (client: 'cursor' | 'claude' | 'windsurf', endpoint: string) => {
    return JSON.stringify(
      {
        mcpServers: {
          mcqhub: {
            command: 'node',
            args: ['d:/MCQHub/mcp-server/index.mjs'],
            env: {
              MCQHUB_API_URL: endpoint,
            },
          },
        },
      },
      null,
      2
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] bg-card border border-border rounded-2xl shadow-xl text-foreground p-0 flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
              {activeTab === 'settings' ? (
                <Settings className="w-4 h-4" />
              ) : activeTab === 'mcp' ? (
                <Bot className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight truncate">
                {user ? (activeTab === 'mcp' ? 'AI MCP Assistant Integration' : 'Account & Settings') : 'Sign In & Settings'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5 truncate">
                {activeTab === 'settings'
                  ? 'Configure personal API keys & cloud sync'
                  : activeTab === 'mcp'
                  ? 'Zero-password AI assistant link (Cursor, Claude, Windsurf)'
                  : 'Sync your quizzes and history across devices'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Unified Tab Component */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full flex-1 flex flex-col min-h-0">
          {/* Tab Navigation - Underline style, no background pills */}
          <div className="shrink-0 bg-card">
            <TabsList className="w-full flex h-auto p-0 bg-transparent border-b border-border rounded-none justify-start">
              <TabsTrigger
                value="auth"
                className="flex-1 py-2.5 text-sm font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground rounded-none shadow-none transition-colors gap-1.5"
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{user ? 'Account' : 'Sign In'}</span>
              </TabsTrigger>
              <TabsTrigger
                value="mcp"
                className="flex-1 py-2.5 text-sm font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground rounded-none shadow-none transition-colors gap-1.5"
              >
                <Bot className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">AI MCP</span>
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="flex-1 py-2.5 text-sm font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground rounded-none shadow-none transition-colors gap-1.5"
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Settings</span>
              </TabsTrigger>
              <TabsTrigger
                value="sessions"
                disabled={!user}
                className="flex-1 py-2.5 text-sm font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground rounded-none shadow-none transition-colors gap-1.5 disabled:opacity-40"
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Devices</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Scrollable Tab Content Container */}
          <div className="overflow-y-auto overscroll-contain flex-1 px-6 py-5 space-y-4">
            {/* TAB 1: AUTHENTICATION / ACCOUNT */}
            <TabsContent value="auth" className="space-y-4 focus-visible:outline-none m-0">
              {!user ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">
                      {authMode === 'login' ? 'Existing Account' : 'Create Free Account'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                          authMode === 'login'
                            ? 'text-primary font-medium bg-secondary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setAuthMode('login')}
                      >
                        Sign In
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                          authMode === 'register'
                            ? 'text-primary font-medium bg-secondary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setAuthMode('register')}
                      >
                        Register
                      </Button>
                    </div>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Username</Label>
                      <input
                        type="text"
                        placeholder="e.g. alex_learner"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm w-full outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground"
                      />
                    </div>

                    {authMode === 'register' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-foreground">Display Name (Optional)</Label>
                        <input
                          type="text"
                          placeholder="e.g. Alex"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm w-full outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Password</Label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm w-full outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground"
                      />
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        Syncs quizzes seamlessly across devices.
                      </span>
                      <Button
                        type="submit"
                        disabled={isAuthLoading}
                        className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 shrink-0 gap-1.5"
                      >
                        {isAuthLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="w-3.5 h-3.5" />
                        )}
                        <span>{authMode === 'login' ? 'Sign In' : 'Create Account'}</span>
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Logged in User Profile Card */}
                  <div className="bg-secondary/50 rounded-2xl p-4 space-y-3 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-sm flex items-center justify-center font-mono">
                          {user.displayName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {user.displayName}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            @{user.username}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium">
                        Connected
                      </span>
                    </div>

                    {/* Records Summary */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <div className="text-muted-foreground text-[11px]">Saved Quizzes</div>
                        <div className="font-semibold text-sm font-mono mt-0.5 text-foreground">{savedQuizzes.length} saved</div>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <div className="text-muted-foreground text-[11px]">Quiz Attempts</div>
                        <div className="font-semibold text-sm font-mono mt-0.5 text-foreground">{history.length} completed</div>
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
                      className="border border-border rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Now'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={logout}
                      className="text-destructive hover:text-destructive/80 text-sm gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: AI MCP INTEGRATION (ZERO-PASSWORD AUTH) */}
            <TabsContent value="mcp" className="space-y-4 focus-visible:outline-none m-0">
              {!user ? (
                <div className="py-8 text-center space-y-3 border border-dashed border-border rounded-2xl p-6 bg-secondary/30">
                  <Bot className="w-8 h-8 mx-auto text-muted-foreground" />
                  <div className="text-sm font-semibold text-foreground">Sign In to Access Your MCP URL</div>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    Sign in with your account to get your personalized zero-password MCP endpoint for Cursor, Claude Desktop, and Windsurf.
                  </p>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 mt-2"
                    onClick={() => setActiveTab('auth')}
                  >
                    Go to Sign In
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Overview Card */}
                  <div className="bg-secondary/50 rounded-2xl p-4 space-y-2 border border-border">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary flex items-center gap-1.5 text-xs">
                        <Bot className="w-4 h-4" />
                        Zero-Password AI Authentication
                      </span>
                      <span className="text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium">
                        Connected
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Connect your AI assistant (Cursor, Windsurf, Claude Desktop, Antigravity) with zero passwords. Quizzes generated by your AI automatically sync directly into your personal MCQHub library across all your devices.
                    </p>
                  </div>

                  {/* Secret Personal Endpoint Box */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <Label className="font-medium text-foreground flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5 text-primary" />
                        <span>Your Private MCP Endpoint</span>
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isRotatingMcp || isLoadingMcp}
                        onClick={handleRotateMcpToken}
                        className="text-muted-foreground hover:text-foreground text-xs h-auto p-0 gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRotatingMcp ? 'animate-spin text-primary' : ''}`} />
                        <span>Regenerate Link</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={isLoadingMcp ? 'Loading secret URL...' : (mcpUrl || '')}
                        className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono w-full outline-none text-muted-foreground select-all"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!mcpUrl || isLoadingMcp}
                        onClick={() => {
                          if (mcpUrl) {
                            navigator.clipboard.writeText(mcpUrl);
                            setCopiedMcpUrl(true);
                            setTimeout(() => setCopiedMcpUrl(false), 2000);
                            addToast('Personal MCP endpoint copied to clipboard!', 'success');
                          }
                        }}
                        className="border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground shrink-0 gap-1"
                      >
                        {copiedMcpUrl ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedMcpUrl ? 'Copied' : 'Copy'}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Client Setup Snippets */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <Label className="font-medium text-foreground">Quick Setup Snippet</Label>
                      <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
                        {(['cursor', 'claude', 'windsurf'] as const).map((client) => (
                          <button
                            key={client}
                            type="button"
                            className={`px-2 py-0.5 text-xs rounded-md capitalize transition-colors ${
                              selectedClient === client
                                ? 'bg-card text-foreground font-medium shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => setSelectedClient(client)}
                          >
                            {client === 'claude' ? 'Claude' : client === 'cursor' ? 'Cursor' : 'Windsurf'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative rounded-xl bg-secondary/50 border border-border p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const snippet = getClientConfigSnippet(selectedClient, mcpUrl || '');
                          navigator.clipboard.writeText(snippet);
                          setCopiedSnippet(true);
                          setTimeout(() => setCopiedSnippet(false), 2000);
                          addToast(`Copied ${selectedClient} configuration snippet!`, 'success');
                        }}
                        className="absolute top-2 right-2 border border-border rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground gap-1 bg-card/80"
                      >
                        {copiedSnippet ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
                      </Button>
                      <pre className="pr-16 leading-relaxed text-[11px]">
                        {getClientConfigSnippet(selectedClient, mcpUrl || 'https://mcqhub.adsbackend01.workers.dev/YOUR_SECRET_TOKEN/mcp')}
                      </pre>
                    </div>
                  </div>

                  {/* Open / Guest Endpoint Note */}
                  <div className="bg-secondary/50 rounded-xl p-3 text-xs text-muted-foreground border border-border flex items-start gap-2.5">
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong className="text-foreground">Open / Guest Endpoint: </strong>
                      The public URL <code className="bg-background px-1.5 py-0.5 rounded text-[11px] font-mono border border-border">https://mcqhub.adsbackend01.workers.dev/api/mcp</code> is always available for unauthenticated guest tests.
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: SETTINGS (API KEY & PREFERENCES) */}
            <TabsContent value="settings" className="space-y-4 focus-visible:outline-none m-0">
              <div className="bg-secondary/50 rounded-2xl p-4 space-y-4 border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">AI Generation Settings</span>
                  </div>
                  {savedApiKey ? (
                    <span className="text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Custom Key Active
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5 font-medium border border-border">
                      Default Engine
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  MCQHub includes free built-in generation. If you prefer using your personal Google Gemini API key with higher limits, add it below:
                </p>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <Label className="font-medium text-foreground">Google Gemini API Key</Label>
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>Get free key from Google AI Studio</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Enter your Gemini API key..."
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-mono w-full outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Account Sync Toggle Row */}
                <div className="flex items-center justify-between py-3 border-t border-b border-border gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="sync-ai-toggle" className="text-xs font-medium cursor-pointer text-foreground block">
                      Sync AI settings and token to account
                    </Label>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Use the same API token across all your devices. Tokens are encrypted before cloud storage.
                    </p>
                  </div>
                  <Switch
                    id="sync-ai-toggle"
                    checked={syncToAccount}
                    onCheckedChange={handleToggleSync}
                    disabled={!user}
                    className="shrink-0 data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Info Box */}
                {!syncToAccount ? (
                  <div className="bg-secondary/50 rounded-xl p-3 text-xs text-muted-foreground border border-border flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                    <span>Your token is stored in your browser local storage and not on our server.</span>
                  </div>
                ) : (
                  <div className="bg-secondary/50 rounded-xl p-3 text-xs text-primary border border-primary/20 flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>End-to-end encrypted (AES-256-GCM). Synced across all your authorized devices.</span>
                  </div>
                )}

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    {user && hasCloudSyncedKey && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isDeletingCloudToken}
                        onClick={handleDeleteCloudToken}
                        className="text-destructive hover:text-destructive/80 text-xs px-2 gap-1 h-auto py-1"
                        title="Permanently remove your encrypted token from the cloud database"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{isDeletingCloudToken ? 'Deleting...' : 'Delete from Cloud'}</span>
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
                        className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 h-auto"
                      >
                        Clear Local
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingKey}
                      onClick={handleSaveApiKey}
                      className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-xs font-medium hover:bg-primary/90"
                    >
                      {isSavingKey ? 'Saving...' : 'Save Key'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Informational Security & Handling Note */}
              <div className="bg-secondary/50 rounded-xl p-3.5 text-xs text-muted-foreground border border-border space-y-2">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>How custom AI tokens are handled</span>
                </div>
                <div className="space-y-1.5 text-[11px] leading-relaxed">
                  <p>
                    <strong className="text-foreground">Client-Side Isolation:</strong> By default, your API token is saved solely within your browser&apos;s local storage and is never uploaded to our servers or databases.
                  </p>
                  <p>
                    <strong className="text-foreground">Strict Database Encryption:</strong> When you enable cross-device sync, your token is encrypted on your device using AES-256-GCM before transmission.
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
              <div className="bg-secondary/50 rounded-xl p-3.5 text-xs text-muted-foreground border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Cloud Sync & Storage</span>
                  </div>
                  <span className="text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium">
                    {user ? 'Auto-sync active' : 'Local storage only'}
                  </span>
                </div>

                <p className="text-xs leading-relaxed">
                  {user
                    ? 'Your custom quizzes and test history automatically synchronize across your laptop, phone, and tablet.'
                    : 'Sign in to sync your questions and test scores across your devices.'}
                </p>

                {user && (
                  <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                    <span className="text-[11px] text-muted-foreground">
                      {lastSyncTime ? `Last synced: ${new Date(lastSyncTime).toLocaleTimeString()}` : 'Ready to sync'}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSyncing}
                      onClick={() => syncLibraryWithCloud(false)}
                      className="border border-border rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground gap-1.5"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 4: SESSIONS */}
            <TabsContent value="sessions" className="space-y-3 focus-visible:outline-none m-0">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  Active login sessions:
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => user && loadSessions(user.username)}
                  className="text-muted-foreground hover:text-foreground text-xs h-auto py-1 px-2 gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </Button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {isLoadingSessions ? (
                  <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    <span>Loading devices...</span>
                  </div>
                ) : sessionList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No active sessions recorded.
                  </div>
                ) : (
                  sessionList.map((s, idx) => (
                    <div
                      key={s.tokenId || idx}
                      className="p-3 rounded-xl border border-border bg-secondary/50 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-primary text-[11px] truncate max-w-[180px]">
                          {s.tokenId}
                        </span>
                        <span
                          className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                            idx === 0
                              ? 'bg-primary/10 text-primary'
                              : 'bg-secondary text-muted-foreground border border-border'
                          }`}
                        >
                          {idx === 0 ? 'Current Device' : 'Other Device'}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex justify-between">
                        <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                        <span className="truncate max-w-[140px]">{s.userAgent}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
