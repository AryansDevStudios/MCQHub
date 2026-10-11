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
  ShieldCheck,
  Activity,
  History,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { getUserSessionsFirestore } from '@/lib/firestoreDb';
import type { UserSession } from '@/lib/types';

interface UserAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'auth' | 'sessions' | 'heuristic';
}

const FIRESTORE_RULES_SNIPPET = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

export function UserAuthDialog({ open, onOpenChange, defaultTab = 'auth' }: UserAuthDialogProps) {
  const {
    user,
    activeSession,
    isAuthLoading,
    login,
    register,
    logout,
    syncToStorage,
    savedQuizzes,
    history,
    heuristicStatus,
    isCheckingHeuristic,
    checkHeuristic,
  } = useQuiz();

  const [activeTab, setActiveTab] = useState<'auth' | 'sessions' | 'heuristic'>(defaultTab);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);
  const [sessionList, setSessionList] = useState<UserSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      if (user) {
        loadSessions(user.username);
      }
    }
  }, [open, defaultTab, user]);

  const loadSessions = async (uname: string) => {
    setIsLoadingSessions(true);
    try {
      const list = await getUserSessionsFirestore(uname);
      setSessionList(list);
    } catch {
      if (activeSession) setSessionList([activeSession]);
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

  const copyRules = () => {
    navigator.clipboard.writeText(FIRESTORE_RULES_SNIPPET);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-foreground p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold tracking-tight">
                  User Account & Cloud Firestore Gateway
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Firebase Cloud Firestore Database • Session Token Authentication
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
            <TabsList className="grid grid-cols-3 mb-4 bg-muted/40 p-1 text-xs">
              <TabsTrigger value="auth" className="gap-1.5 text-xs py-1.5">
                <User className="w-3.5 h-3.5" />
                <span>{user ? 'Account' : 'Authentication'}</span>
              </TabsTrigger>
              <TabsTrigger value="sessions" className="gap-1.5 text-xs py-1.5" disabled={!user}>
                <History className="w-3.5 h-3.5" />
                <span>Sessions & Tokens</span>
              </TabsTrigger>
              <TabsTrigger value="heuristic" className="gap-1.5 text-xs py-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Heuristic Diagnostic</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: AUTHENTICATION / ACCOUNT */}
            <TabsContent value="auth" className="space-y-4 focus-visible:outline-none">
              {!user ? (
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
                    <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      {authMode === 'login' ? 'Existing User Sign In' : 'New User Registration'}
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
                        Create Account
                      </Button>
                    </div>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Username (Unique Identifier)</Label>
                      <Input
                        type="text"
                        placeholder="e.g. aryansdevstudios"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="h-8 text-xs font-mono bg-background"
                      />
                    </div>

                    {authMode === 'register' && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Display Name (Optional)</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Aryan Sharma"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="h-8 text-xs bg-background"
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
                        className="h-8 text-xs font-mono bg-background"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Firestore path: <code className="text-primary">users/{'{username}'}</code>
                      </span>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isAuthLoading}
                        className="h-8 text-xs px-4 bg-primary text-primary-foreground font-medium"
                      >
                        {isAuthLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {authMode === 'login' ? 'Sign In to Firestore' : 'Create & Register'}
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
                        <div className="w-9 h-9 rounded bg-primary/10 border border-primary/20 flex items-center justify-center font-mono font-bold text-primary text-sm">
                          {user.displayName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-1.5">
                            {user.displayName}
                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                              {user.userId}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">@{user.username}</div>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                        Authenticated
                      </Badge>
                    </div>

                    {/* Active Token ID Box */}
                    {activeSession && (
                      <div className="p-2 rounded bg-background border border-border/60 text-xs space-y-1">
                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                          <span>Active Session Token ID</span>
                          <button
                            type="button"
                            onClick={() => copyToken(activeSession.tokenId)}
                            className="flex items-center gap-1 hover:text-foreground text-[10px] text-primary"
                          >
                            {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {copiedToken ? 'Copied' : 'Copy Token'}
                          </button>
                        </div>
                        <div className="font-mono text-[11px] truncate text-foreground/90 select-all">
                          {activeSession.tokenId}
                        </div>
                      </div>
                    )}

                    {/* Firestore Records Summary */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded bg-background/50 border border-border/40">
                        <div className="text-muted-foreground text-[11px]">Library Quizzes</div>
                        <div className="font-semibold text-sm font-mono mt-0.5">{savedQuizzes.length} stored</div>
                      </div>
                      <div className="p-2 rounded bg-background/50 border border-border/40">
                        <div className="text-muted-foreground text-[11px]">Exam Attempts</div>
                        <div className="font-semibold text-sm font-mono mt-0.5">{history.length} logged</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={syncToStorage}
                      className="h-8 text-xs gap-1.5 border-border/80"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-primary" />
                      Sync Firestore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={logout}
                      className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: SESSIONS & TOKEN HISTORY */}
            <TabsContent value="sessions" className="space-y-3 focus-visible:outline-none">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">
                  Login audit log in Firestore doc: <code className="text-primary">users/{user?.username}</code>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => user && loadSessions(user.username)}
                  className="h-6 px-2 text-[11px] gap-1 font-mono"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </Button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {isLoadingSessions ? (
                  <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    Fetching sessions from Firestore...
                  </div>
                ) : sessionList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No prior session history recorded.
                  </div>
                ) : (
                  sessionList.map((s, idx) => (
                    <div
                      key={s.tokenId || idx}
                      className="p-2.5 rounded border border-border/60 bg-muted/20 text-xs space-y-1 font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-primary truncate max-w-[200px]">
                          {s.tokenId}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            idx === 0
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] py-0'
                              : 'text-[10px] py-0 text-muted-foreground'
                          }
                        >
                          {idx === 0 ? 'Current Session' : 'Prior Login'}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex justify-between">
                        <span>{new Date(s.timestamp).toLocaleString()}</span>
                        <span className="truncate max-w-[150px] text-[10px]">{s.userAgent}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* TAB 3: HEURISTIC DIAGNOSTIC */}
            <TabsContent value="heuristic" className="space-y-3.5 focus-visible:outline-none">
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        heuristicStatus?.ok
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                          : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                      }`}
                    />
                    <span className="text-xs font-semibold">
                      {heuristicStatus?.ok ? 'Cloud Firestore Active' : 'Firestore Heuristic Status'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isCheckingHeuristic}
                    onClick={checkHeuristic}
                    className="h-7 text-xs px-2.5 gap-1.5 font-mono"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingHeuristic ? 'animate-spin text-primary' : ''}`} />
                    Run Ping Probe
                  </Button>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Database Engine:</span>
                    <span className="text-foreground">Google Cloud Firestore (Default)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Project ID:</span>
                    <span className="text-foreground">mcqhub-724e3</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Edge Gateway:</span>
                    <span className="text-foreground">Cloudflare Workers (Ad-Block Immune)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Round-trip Latency:</span>
                    <span className={heuristicStatus?.ok ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {heuristicStatus ? `${heuristicStatus.latencyMs} ms` : 'Not tested'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Heuristic Probe:</span>
                    <span className="text-primary">Worker /api/heuristic &rarr; Firestore /system/heuristic</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Last Checked:</span>
                    <span className="text-muted-foreground">
                      {heuristicStatus?.timestamp ? new Date(heuristicStatus.timestamp).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>

                {heuristicStatus?.error && (
                  <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-200/90 flex gap-2 items-start">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <div><strong>Notice:</strong> {heuristicStatus.error}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Local storage backup is actively preserving all registration, tokens, and assessments in the meantime.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Firestore Security Rules Box */}
              <div className="p-3 rounded-lg border border-border/70 bg-background/50 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Firestore Rules (<code className="font-mono text-[11px]">firestore.rules</code>)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyRules}
                    className="h-6 px-2 text-[10px] font-mono gap-1 text-primary hover:text-foreground"
                  >
                    {copiedRules ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedRules ? 'Copied' : 'Copy Rules'}</span>
                  </Button>
                </div>
                <pre className="p-2 rounded bg-muted/40 border border-border/50 text-[10px] font-mono text-muted-foreground overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                </pre>
                <p className="text-[10px] text-muted-foreground">
                  Paste this into <strong>Firebase Console &gt; Firestore Database &gt; Rules</strong> to grant read/write access.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
