import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Flame, Sparkles, Terminal } from 'lucide-react';
import { publicApi } from '../lib/api';
import type { Language } from '../lib/types';
import { useLearner } from '../contexts/LearnerContext';
import { levelOf, levelProgress, plural, rankOf } from '../lib/format';
import ProgressRing from '../components/ProgressRing';
import Hearts from '../components/Hearts';
import Footer from '../components/Footer';
import { ErrorNote, Skeleton } from '../components/Loading';

type Stats = {
  learners: number;
  lessons: number;
  languages: number;
  completions: number;
  runs: number;
};

export default function Home() {
  const { profile, progress, achievements, isGuest, loading: learnerLoading } = useLearner();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [langs, s] = await Promise.all([
        publicApi<Language[]>('/api/languages'),
        publicApi<Stats>('/api/stats'),
      ]);
      setLanguages(langs);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the curriculum.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const doneByLang = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of progress) {
      if (p.status === 'completed') m[p.language_slug] = (m[p.language_slug] || 0) + 1;
    }
    return m;
  }, [progress]);

  const nextUp = useMemo(() => {
    const started = languages
      .map((l) => ({ l, done: doneByLang[l.slug] || 0 }))
      .filter((x) => x.done > 0 && x.done < (x.l.lesson_count || 0))
      .sort((a, b) => b.done - a.done);
    return started[0]?.l || null;
  }, [languages, doneByLang]);

  const earnedCount = achievements.filter((a) => a.earned).length;
  const totalDone = progress.filter((p) => p.status === 'completed').length;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="grain absolute inset-0 opacity-60" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 12% 0%, rgba(161,87,58,0.07), transparent 55%), radial-gradient(90% 70% at 90% 10%, rgba(75,90,107,0.07), transparent 60%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted"
          >
            Five languages · from zero
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-3xl font-serif text-[2.6rem] leading-[1.06] tracking-[-0.02em] text-ink sm:text-[4rem]"
          >
            Start at nothing.
            <br />
            <span className="text-clay">Compile something.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-ink-soft"
          >
            Short lessons, one idea each. Write real code in a real compiler, get graded on real
            output, and collect XP as you go. No prior experience assumed — lesson one is literally
            printing a line of text.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <a
              href="#tracks"
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-paper transition-opacity hover:opacity-88"
            >
              {nextUp ? `Continue ${nextUp.name}` : 'Choose a language'}
              <ArrowRight
                size={14}
                className="transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </a>
            <Link
              to="/playground"
              className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-[13.5px] text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
            >
              <Terminal size={13} /> Open playground
            </Link>
          </motion.div>

          {stats && (
            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.34 }}
              className="mt-16 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4"
            >
              {[
                { k: 'Languages', v: stats.languages },
                { k: 'Lessons', v: stats.lessons },
                { k: 'Learners', v: stats.learners },
                { k: 'Programs run', v: stats.runs },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    {s.k}
                  </dt>
                  <dd className="mt-1 font-serif text-2xl text-ink">{s.v}</dd>
                </div>
              ))}
            </motion.dl>
          )}
        </div>
      </section>

      {profile && !learnerLoading && (profile.xp > 0 || totalDone > 0) && (
        <section className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-5">
              <ProgressRing
                value={levelProgress(profile.xp)}
                size={54}
                label={`L${levelOf(profile.xp)}`}
              />
              <div>
                <p className="text-[14.5px] text-ink">
                  {rankOf(profile.xp)} · {profile.xp} XP
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {plural(totalDone, 'lesson')} done · {plural(earnedCount, 'badge')} earned
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-clay" />
                <span className="text-[12.5px] text-ink-soft">
                  {plural(profile.streak, 'day')} streak
                </span>
              </div>
              <Hearts count={profile.hearts ?? 5} />
              <Link
                to="/profile"
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-clay underline decoration-clay/25 underline-offset-4 transition-colors hover:decoration-clay"
              >
                Progress
              </Link>
            </div>
          </div>
        </section>
      )}

      <section id="tracks" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted">
              The tracks
            </p>
            <h2 className="mt-3 font-serif text-3xl tracking-tight text-ink sm:text-4xl">
              Pick where to begin
            </h2>
          </div>
          {isGuest && (
            <Link
              to="/login"
              className="hidden shrink-0 text-[12.5px] text-muted transition-colors hover:text-ink sm:block"
            >
              Sign in to sync progress →
            </Link>
          )}
        </div>

        {error && (
          <div className="mt-8">
            <ErrorNote message={error} onRetry={load} />
          </div>
        )}

        {loading ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {languages.map((l, i) => {
              const done = doneByLang[l.slug] || 0;
              const total = l.lesson_count || 0;
              const pct = total ? done / total : 0;
              return (
                <motion.div
                  key={l.slug}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link
                    to={`/learn/${l.slug}`}
                    className="group flex h-full flex-col justify-between rounded-xl border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_18px_40px_-30px_rgba(28,27,23,0.5)]"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <span
                            className="font-mono text-[22px] leading-none"
                            style={{ color: l.accent }}
                          >
                            {l.glyph}
                          </span>
                          <h3 className="mt-4 font-serif text-2xl tracking-tight text-ink">
                            {l.name}
                          </h3>
                          <p className="mt-1 text-[13px] text-muted">{l.tagline}</p>
                        </div>
                        {done > 0 ? (
                          <ProgressRing value={pct} size={44} label={`${done}/${total}`} />
                        ) : (
                          <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                            {l.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">{l.blurb}</p>
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-line-soft pt-4">
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                        {l.module_count} modules · {total} lessons
                      </span>
                      <span className="flex items-center gap-1 text-[12.5px] text-clay">
                        {done > 0 ? 'Continue' : 'Start'}
                        <ArrowRight
                          size={12}
                          className="transition-transform duration-300 group-hover:translate-x-0.5"
                        />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted">
            How a lesson works
          </p>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              {
                n: '01',
                t: 'Read one idea',
                d: 'Every lesson explains a single concept in plain language, with a worked example you can read top to bottom.',
              },
              {
                n: '02',
                t: 'Write the code',
                d: 'The editor has syntax highlighting, auto-indent, bracket pairs and comment toggling. Starter code gets you moving.',
              },
              {
                n: '03',
                t: 'Run it for real',
                d: 'Your program is compiled and executed on a server, then its output is diffed against the expected result to grade you.',
              },
            ].map((s) => (
              <div key={s.n}>
                <span className="font-mono text-[11px] tracking-[0.16em] text-clay">{s.n}</span>
                <h3 className="mt-3 font-serif text-xl text-ink">{s.t}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{s.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-line pt-8">
            <Sparkles size={14} className="text-clay" />
            <p className="text-[13.5px] text-ink-soft">
              Badges, streaks and hearts keep the pressure light — fail a check and you lose a
              heart, pass a lesson and they all come back.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
