import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Flame, X } from 'lucide-react';
import { api, publicApi } from '../lib/api';
import type { Language } from '../lib/types';
import { useLearner } from '../contexts/LearnerContext';
import { useAuth } from '../contexts/AuthContext';
import { LEVEL_STEP, levelOf, levelProgress, plural, rankOf, timeAgo } from '../lib/format';
import ProgressRing from '../components/ProgressRing';
import Hearts from '../components/Hearts';
import Footer from '../components/Footer';
import { ErrorNote, Skeleton } from '../components/Loading';

type Sub = {
  id: number;
  lesson_id: number;
  language_slug: string;
  passed: boolean;
  created_at: string;
  lesson_title: string;
  lesson_slug: string;
};

export default function Profile() {
  const { profile, progress, achievements, loading, error, refresh, userKey, isGuest } =
    useLearner();
  const { user } = useAuth();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [sideError, setSideError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [langs, s] = await Promise.all([
          publicApi<Language[]>('/api/languages'),
          api<Sub[]>('/api/submissions'),
        ]);
        if (!alive) return;
        setLanguages(langs);
        setSubs(s);
      } catch (e) {
        if (alive) setSideError(e instanceof Error ? e.message : 'Could not load activity.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [userKey, progress.length]);

  const doneByLang = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of progress) if (p.status === 'completed') m[p.language_slug] = (m[p.language_slug] || 0) + 1;
    return m;
  }, [progress]);

  const totalDone = progress.filter((p) => p.status === 'completed').length;
  const attempts = progress.reduce((s, p) => s + (p.attempts || 0), 0);
  const firstTry = progress.filter((p) => p.status === 'completed' && (p.attempts || 1) <= 1).length;
  const accuracy = totalDone ? Math.round((firstTry / totalDone) * 100) : 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-6 h-12 w-72" />
        <div className="mt-12 grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="mt-10 h-64" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <ErrorNote message={error || 'Could not load your profile.'} onRetry={() => void refresh()} />
      </div>
    );
  }

  const xpToNext = LEVEL_STEP - (profile.xp % LEVEL_STEP);

  return (
    <div>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted">
            Your progress
          </p>
          <div className="mt-6 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-6">
              <ProgressRing
                value={levelProgress(profile.xp)}
                size={80}
                stroke={4}
                label={`L${levelOf(profile.xp)}`}
              />
              <div>
                <h1 className="font-serif text-[2rem] leading-tight tracking-tight text-ink">
                  {user?.email?.split('@')[0] || profile.display_name}
                </h1>
                <p className="mt-1 text-[13.5px] text-muted">
                  {rankOf(profile.xp)} · {profile.xp} XP · {xpToNext} to level{' '}
                  {levelOf(profile.xp) + 1}
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
                    <Flame size={12} className="text-clay" /> {plural(profile.streak, 'day')}
                  </span>
                  <Hearts count={profile.hearts ?? 5} />
                </div>
              </div>
            </div>

            {isGuest && (
              <div className="max-w-xs rounded-lg border border-line bg-paper p-4">
                <p className="text-[13px] text-ink">Learning as a guest</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  Progress lives in this browser only. Sign in and it moves to your account.
                </p>
                <Link
                  to="/login"
                  className="mt-3 inline-block font-mono text-[10.5px] uppercase tracking-[0.14em] text-clay underline decoration-clay/25 underline-offset-4 hover:decoration-clay"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            {[
              { k: 'Lessons cleared', v: totalDone },
              { k: 'Total attempts', v: attempts },
              { k: 'First-try rate', v: `${accuracy}%` },
              { k: 'Badges', v: `${achievements.filter((a) => a.earned).length}/${achievements.length}` },
            ].map((s) => (
              <div key={s.k}>
                <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
                  {s.k}
                </dt>
                <dd className="mt-1 font-serif text-2xl text-ink">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <h2 className="font-serif text-2xl tracking-tight text-ink">Tracks</h2>
        <div className="mt-6 divide-y divide-line-soft border-y border-line">
          {languages.map((l) => {
            const done = doneByLang[l.slug] || 0;
            const total = l.lesson_count || 0;
            return (
              <Link
                key={l.slug}
                to={`/learn/${l.slug}`}
                className="group flex items-center gap-5 py-4 transition-colors hover:bg-surface/60"
              >
                <span className="w-6 shrink-0 font-mono text-[17px]" style={{ color: l.accent }}>
                  {l.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-ink">{l.name}</p>
                  <div className="mt-2 h-[3px] w-full max-w-xs overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${total ? (done / total) * 100 : 0}%`,
                        background: l.accent,
                      }}
                    />
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {done}/{total}
                </span>
              </Link>
            );
          })}
          {languages.length === 0 && (
            <p className="py-6 text-[13px] text-muted">No tracks loaded.</p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-14 sm:px-8">
        <h2 className="font-serif text-2xl tracking-tight text-ink">Badges</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a, i) => (
            <motion.div
              key={a.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.4) }}
              className={`rounded-lg border p-4 ${
                a.earned ? 'border-line bg-surface' : 'border-line-soft bg-transparent opacity-55'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`font-mono text-[15px] ${a.earned ? 'text-clay' : 'text-faint'}`}>
                  {a.glyph}
                </span>
                <span className="font-mono text-[10px] text-faint">+{a.xp}</span>
              </div>
              <p className="mt-3 text-[13.5px] text-ink">{a.title}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-muted">{a.description}</p>
              {a.earned && a.earned_at && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-moss">
                  Earned {timeAgo(a.earned_at)}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
        <h2 className="font-serif text-2xl tracking-tight text-ink">Recent runs</h2>
        {sideError && (
          <div className="mt-4">
            <ErrorNote message={sideError} />
          </div>
        )}
        {subs.length === 0 ? (
          <p className="mt-4 text-[13.5px] text-muted">
            Nothing yet.{' '}
            <Link to="/" className="text-clay underline decoration-clay/25 underline-offset-4">
              Start a lesson
            </Link>{' '}
            and your submissions land here.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-line-soft border-y border-line">
            {subs.slice(0, 14).map((s) => (
              <li key={s.id} className="flex items-center gap-4 py-3">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    s.passed ? 'bg-moss/12 text-moss' : 'bg-clay/10 text-clay'
                  }`}
                >
                  {s.passed ? <Check size={11} /> : <X size={11} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-ink">{s.lesson_title}</p>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
                    {s.language_slug}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10.5px] text-muted">
                  {timeAgo(s.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Footer />
    </div>
  );
}
