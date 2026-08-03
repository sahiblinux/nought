import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, postJson, guestKey, ApiError } from '../lib/api';
import type { Achievement, Profile, ProgressRow } from '../lib/types';
import { useAuth } from './AuthContext';

export type Toast = { id: number; title: string; body?: string; glyph?: string };

type SubmitPayload = {
  lessonId: number;
  languageSlug: string;
  code: string;
  output: string;
  passed: boolean;
};

type LearnerValue = {
  userKey: string;
  isGuest: boolean;
  profile: Profile | null;
  progress: ProgressRow[];
  achievements: Achievement[];
  loading: boolean;
  error: string | null;
  completed: Set<number>;
  refresh: () => Promise<void>;
  submit: (p: SubmitPayload) => Promise<{ xpGained: number } | null>;
  loseHeart: () => Promise<void>;
  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
};

const LearnerContext = createContext<LearnerValue | null>(null);

export function LearnerProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [guest] = useState(() => guestKey());
  const userKey = user?.id || guest;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    if (authLoading) return;
    setError(null);
    try {
      const params = new URLSearchParams();
      if (user) params.set('migrate_from', guest);
      const qs = params.toString();
      const data = await api<{
        profile: Profile;
        progress: ProgressRow[];
        achievements: Achievement[];
      }>(`/api/me${qs ? `?${qs}` : ''}`);
      setProfile(data.profile);
      setProgress(data.progress);
      setAchievements(data.achievements);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your progress.');
    } finally {
      setLoading(false);
    }
  }, [authLoading, userKey, user, guest]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(
    async ({ lessonId, languageSlug, code, output, passed }: SubmitPayload) => {
      try {
        const res = await postJson<{
          profile: Profile;
          progress: ProgressRow;
          newAchievements: Achievement[];
          xpGained: number;
          passed: boolean;
        }>('/api/progress', {
          lesson_id: lessonId,
          language_slug: languageSlug,
          code,
          output,
          passed,
        });
        setProfile(res.profile);
        setProgress((prev) => {
          const rest = prev.filter((p) => p.lesson_id !== lessonId);
          return res.progress ? [...rest, res.progress] : rest;
        });
        if (res.newAchievements?.length) {
          setAchievements((prev) =>
            prev.map((a) =>
              res.newAchievements.some((n) => n.slug === a.slug)
                ? { ...a, earned: true, earned_at: new Date().toISOString() }
                : a
            )
          );
          for (const a of res.newAchievements) {
            pushToast({ title: a.title, body: `${a.description} · +${a.xp} XP`, glyph: a.glyph });
          }
        }
        return { xpGained: res.xpGained || 0 };
      } catch (e) {
        const expired = e instanceof ApiError && e.status === 401;
        pushToast({
          title: expired ? 'Session expired' : 'Could not save progress',
          body: expired
            ? 'Please sign in again — your work is still in the editor.'
            : e instanceof Error
              ? e.message
              : 'Unknown error',
          glyph: '!',
        });
        return null;
      }
    },
    [pushToast]
  );

  const loseHeart = useCallback(async () => {
    try {
      const res = await postJson<{ profile: Profile }>('/api/progress', {
        heart_loss: true,
      });
      setProfile(res.profile);
    } catch {
      /* non-critical */
    }
  }, []);

  const completed = useMemo(
    () => new Set(progress.filter((p) => p.status === 'completed').map((p) => p.lesson_id)),
    [progress]
  );

  const value: LearnerValue = {
    userKey,
    isGuest: !user,
    profile,
    progress,
    achievements,
    loading,
    error,
    completed,
    refresh,
    submit,
    loseHeart,
    toasts,
    pushToast,
    dismissToast,
  };

  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>;
}

export function useLearner() {
  const ctx = useContext(LearnerContext);
  if (!ctx) throw new Error('useLearner must be used inside LearnerProvider');
  return ctx;
}
