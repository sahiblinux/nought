import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, HelpCircle, Lock } from 'lucide-react';
import { publicApi } from '../lib/api';
import type { Language, LessonStub, Module } from '../lib/types';
import { useLearner } from '../contexts/LearnerContext';
import ProgressRing from '../components/ProgressRing';
import Footer from '../components/Footer';
import { ErrorNote, Skeleton } from '../components/Loading';

type Payload = { language: Language; modules: Module[]; lessons: LessonStub[] };

export default function Track() {
  const { lang = '' } = useParams();
  const { completed, progress } = useLearner();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await publicApi<Payload>(`/api/curriculum?language=${encodeURIComponent(lang)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this track.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const unlockedIndex = useMemo(() => {
    if (!data) return 0;
    let i = 0;
    while (i < data.lessons.length && completed.has(data.lessons[i].id)) i += 1;
    return i;
  }, [data, completed]);

  const attemptedIds = useMemo(
    () => new Set(progress.map((p) => p.lesson_id)),
    [progress]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-6 h-12 w-64" />
        <Skeleton className="mt-3 h-4 w-80" />
        <div className="mt-14 space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <ErrorNote message={error || 'Track not found.'} onRetry={load} />
        <Link to="/" className="mt-6 inline-block text-[13px] text-clay">
          ← Back to languages
        </Link>
      </div>
    );
  }

  const { language, modules, lessons } = data;
  const doneCount = lessons.filter((l) => completed.has(l.id)).length;
  const nextLesson = lessons[unlockedIndex] || null;

  return (
    <div>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={11} /> All languages
          </Link>

          <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="font-mono text-[26px] leading-none" style={{ color: language.accent }}>
                {language.glyph}
              </span>
              <h1 className="mt-4 font-serif text-[2.5rem] leading-none tracking-tight text-ink">
                {language.name}
              </h1>
              <p className="mt-2 text-[14.5px] text-muted">{language.tagline}</p>
              <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-ink-soft">
                {language.blurb}
              </p>
              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                {[
                  { k: 'First released', v: language.born },
                  { k: 'Paradigm', v: language.paradigm },
                  { k: 'Difficulty', v: language.difficulty },
                ].map((x) => (
                  <div key={x.k}>
                    <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
                      {x.k}
                    </dt>
                    <dd className="mt-0.5 text-[13px] text-ink-soft">{x.v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex shrink-0 items-center gap-5 sm:flex-col sm:items-end">
              <ProgressRing
                value={lessons.length ? doneCount / lessons.length : 0}
                size={72}
                stroke={4}
                label={`${doneCount}/${lessons.length}`}
              />
              {nextLesson ? (
                <Link
                  to={`/learn/${language.slug}/${nextLesson.slug}`}
                  className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] text-paper transition-opacity hover:opacity-88"
                >
                  {doneCount > 0 ? 'Continue' : 'Start lesson 1'}
                  <ArrowRight
                    size={13}
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  />
                </Link>
              ) : (
                <span className="rounded-full border border-moss/30 bg-moss/[0.07] px-4 py-2 text-[12.5px] text-moss">
                  Track complete
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="space-y-14">
          {modules.map((m, mi) => {
            const mLessons = lessons.filter((l) => l.module_slug === m.slug);
            const mDone = mLessons.filter((l) => completed.has(l.id)).length;
            return (
              <motion.div
                key={m.slug}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: Math.min(mi * 0.05, 0.3) }}
              >
                <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
                      {String(mi + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h2 className="font-serif text-xl tracking-tight text-ink">{m.title}</h2>
                      <p className="mt-0.5 text-[13px] text-muted">{m.summary}</p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px] text-faint">
                    {mDone}/{mLessons.length}
                  </span>
                </div>

                <ol className="mt-1">
                  {mLessons.map((l) => {
                    const idx = lessons.findIndex((x) => x.id === l.id);
                    const isDone = completed.has(l.id);
                    const locked = idx > unlockedIndex;
                    const isNext = idx === unlockedIndex;
                    const attempted = attemptedIds.has(l.id) && !isDone;

                    const inner = (
                      <div
                        className={`flex items-center gap-4 border-b border-line-soft py-4 transition-colors ${
                          locked ? 'opacity-45' : 'group-hover:bg-surface/70'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono ${
                            isDone
                              ? 'border-moss/40 bg-moss/10 text-moss'
                              : isNext
                                ? 'border-clay/50 bg-clay/[0.06] text-clay'
                                : 'border-line text-faint'
                          }`}
                        >
                          {isDone ? (
                            <Check size={12} />
                          ) : locked ? (
                            <Lock size={10} />
                          ) : (
                            idx + 1
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[14px] text-ink">{l.title}</p>
                            {l.kind === 'quiz' && (
                              <HelpCircle size={11} className="shrink-0 text-slate" />
                            )}
                            {attempted && (
                              <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.14em] text-amber">
                                in progress
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[12.5px] text-muted">{l.subtitle}</p>
                        </div>

                        <span className="shrink-0 font-mono text-[10.5px] text-faint">
                          +{l.xp} xp
                        </span>
                        {!locked && (
                          <ArrowRight
                            size={13}
                            className="shrink-0 text-faint transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-ink"
                          />
                        )}
                      </div>
                    );

                    return (
                      <li key={l.id}>
                        {locked ? (
                          <div
                            className="cursor-not-allowed"
                            title="Finish the previous lesson to unlock"
                          >
                            {inner}
                          </div>
                        ) : (
                          <Link to={`/learn/${language.slug}/${l.slug}`} className="group block">
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </motion.div>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}
