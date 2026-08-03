import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  Lightbulb,
  Loader2,
  Play,
  RotateCcw,
} from 'lucide-react';
import { publicApi, postJson } from '../lib/api';
import type { Language, Lesson, LessonStub, Module, RunResult } from '../lib/types';
import { useLearner } from '../contexts/LearnerContext';
import { gradeOutput, plural } from '../lib/format';
import CodeEditor from '../components/CodeEditor';
import CodeBlock from '../components/CodeBlock';
import Console from '../components/Console';
import Prose from '../components/Prose';
import Hearts from '../components/Hearts';
import { ErrorNote, Skeleton } from '../components/Loading';

type Payload = {
  lesson: Lesson;
  language: Language;
  module: Module | null;
  flat: LessonStub[];
  index: number;
  prev: LessonStub | null;
  next: LessonStub | null;
};

const draftKey = (lang: string, slug: string) => `nought:draft:${lang}:${slug}`;

export default function LessonPage() {
  const { lang = '', slug = '' } = useParams();
  const navigate = useNavigate();
  const { submit, completed, profile, progress, pushToast } = useLearner();

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [hintsOpen, setHintsOpen] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [celebrate, setCelebrate] = useState<{ xp: number } | null>(null);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const savedRef = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setResult(null);
    setRunError(null);
    setPassed(null);
    setHintsOpen(0);
    setShowSolution(false);
    setCelebrate(null);
    setAnswers({});
    setQuizChecked(false);
    try {
      const d = await publicApi<Payload>(
        `/api/lesson?language=${encodeURIComponent(lang)}&slug=${encodeURIComponent(slug)}`
      );
      setData(d);
      const draft = localStorage.getItem(draftKey(lang, slug));
      const best = progress.find((p) => p.lesson_id === d.lesson.id)?.best_code;
      const initial = draft || best || d.lesson.starter_code || '';
      setCode(initial);
      savedRef.current = initial;
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load this lesson.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data || code === savedRef.current) return;
    const t = window.setTimeout(() => {
      localStorage.setItem(draftKey(lang, slug), code);
      savedRef.current = code;
    }, 600);
    return () => window.clearTimeout(t);
  }, [code, data, lang, slug]);

  const lesson = data?.lesson;
  const isQuiz = lesson?.kind === 'quiz';
  const questions = useMemo(() => lesson?.quiz?.questions || [], [lesson]);
  const alreadyDone = lesson ? completed.has(lesson.id) : false;

  const finish = useCallback(
    async (ok: boolean, output: string) => {
      if (!lesson) return;
      const res = await submit({
        lessonId: lesson.id,
        languageSlug: lesson.language_slug,
        code: isQuiz ? JSON.stringify(answers) : code,
        output,
        passed: ok,
      });
      if (ok && res && res.xpGained > 0) setCelebrate({ xp: res.xpGained });
      else if (ok && alreadyDone) setCelebrate({ xp: 0 });
    },
    [lesson, submit, isQuiz, answers, code, alreadyDone]
  );

  const run = useCallback(
    async (grade = true) => {
      if (!lesson || !data || running) return;
      if (!code.trim()) {
        setRunError('There is no code to run yet.');
        return;
      }
      setRunning(true);
      setRunError(null);
      setResult(null);
      setPassed(null);
      try {
        const r = await postJson<RunResult>('/api/run', {
          language: data.language.slug,
          code,
        });
        setResult(r);
        const combined = r.stdout || '';
        const hardFail = !!(r.compileOutput?.trim() || r.stderr?.trim());
        if (grade && lesson.expected_output) {
          const ok = !hardFail && gradeOutput(combined, lesson.expected_output, lesson.check_mode);
          setPassed(ok);
          await finish(ok, combined || r.stderr || r.compileOutput || '');
        } else if (grade) {
          const ok = !hardFail;
          setPassed(ok);
          await finish(ok, combined);
        }
      } catch (e) {
        setRunError(e instanceof Error ? e.message : 'Could not run your code.');
      } finally {
        setRunning(false);
      }
    },
    [lesson, data, running, code, finish]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  const checkQuiz = async () => {
    if (!questions.length) return;
    setQuizChecked(true);
    const ok = questions.every((q, i) => answers[i] === q.answer);
    setPassed(ok);
    await finish(ok, `${questions.filter((q, i) => answers[i] === q.answer).length}/${questions.length} correct`);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <Skeleton className="h-3 w-32" />
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (loadError || !data || !lesson) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <ErrorNote message={loadError || 'Lesson not found.'} onRetry={load} />
        <Link to={`/learn/${lang}`} className="mt-6 inline-block text-[13px] text-clay">
          ← Back to the track
        </Link>
      </div>
    );
  }

  const { language, module, flat, index, prev, next } = data;
  const hints = lesson.hints || [];
  const trackDone = flat.filter((l) => completed.has(l.id)).length;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 border-b border-line bg-paper/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              to={`/learn/${language.slug}`}
              className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-ink"
            >
              <ArrowLeft size={11} />
              <span className="hidden sm:inline">{language.name}</span>
            </Link>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <p className="truncate text-[13px] text-ink-soft">
              <span className="font-mono text-[11px] text-faint">
                {String(index + 1).padStart(2, '0')}/{flat.length}
              </span>
              <span className="mx-2 text-faint">·</span>
              {module?.title}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            {profile && <Hearts count={profile.hearts ?? 5} />}
            <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted sm:inline">
              {trackDone}/{flat.length} done
            </span>
          </div>
        </div>
        <div className="h-[2px] w-full bg-line-soft">
          <div
            className="h-full bg-clay transition-all duration-700"
            style={{ width: `${((index + (alreadyDone ? 1 : 0)) / flat.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:py-14">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-clay">
            {isQuiz ? 'Checkpoint quiz' : `Lesson ${index + 1}`}
          </p>
          <h1 className="mt-4 font-serif text-[2.1rem] leading-[1.12] tracking-tight text-ink sm:text-[2.5rem]">
            {lesson.title}
          </h1>
          <p className="mt-2 text-[14.5px] text-muted">{lesson.subtitle}</p>

          <div className="mt-8">
            <Prose text={lesson.concept} />
          </div>

          {lesson.example_code?.trim() && (
            <div className="mt-8">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                Worked example
              </p>
              <CodeBlock code={lesson.example_code} lang={language.slug} />
              {lesson.example_note && (
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                  {lesson.example_note}
                </p>
              )}
            </div>
          )}

          {!isQuiz && (
            <div className="mt-8 rounded-lg border border-line bg-surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-clay">
                Your task
              </p>
              <div className="mt-3">
                <Prose text={lesson.task} />
              </div>
              {lesson.expected_output?.trim() && (
                <div className="mt-4 border-t border-line-soft pt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    {lesson.check_mode === 'contains'
                      ? 'Output must contain'
                      : 'Expected output'}
                  </p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-ink">
                    {lesson.expected_output}
                  </pre>
                </div>
              )}
            </div>
          )}

          {!isQuiz && hints.length > 0 && (
            <div className="mt-6">
              <div className="space-y-2">
                {hints.slice(0, hintsOpen).map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 rounded-lg border border-line bg-sunk/50 px-4 py-3"
                  >
                    <Lightbulb size={13} className="mt-0.5 shrink-0 text-amber" />
                    <p className="text-[13px] leading-relaxed text-ink-soft">{h}</p>
                  </motion.div>
                ))}
              </div>
              {hintsOpen < hints.length && (
                <button
                  onClick={() => setHintsOpen((v) => v + 1)}
                  className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
                >
                  <Lightbulb size={11} />
                  {hintsOpen === 0 ? `Show a hint (${hints.length})` : 'Next hint'}
                </button>
              )}
            </div>
          )}

          {!isQuiz && lesson.solution_code?.trim() && (
            <div className="mt-6">
              <button
                onClick={() => setShowSolution((v) => !v)}
                className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
              >
                <Eye size={11} /> {showSolution ? 'Hide solution' : 'Reveal solution'}
                <ChevronDown
                  size={11}
                  className={`transition-transform duration-300 ${showSolution ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence>
                {showSolution && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3">
                      <CodeBlock code={lesson.solution_code} lang={language.slug} />
                      <button
                        onClick={() => setCode(lesson.solution_code)}
                        className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-clay underline decoration-clay/25 underline-offset-4 hover:decoration-clay"
                      >
                        Copy into editor
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="lg:sticky lg:top-24">
            {isQuiz ? (
              <div className="space-y-5">
                {questions.map((q, qi) => {
                  const chosen = answers[qi];
                  return (
                    <div key={qi} className="rounded-lg border border-line bg-surface p-5">
                      <p className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
                        <span className="font-mono text-[11px] text-faint">Q{qi + 1}</span>
                        {q.q}
                      </p>
                      <div className="mt-3.5 space-y-1.5">
                        {q.options.map((opt, oi) => {
                          const isChosen = chosen === oi;
                          const isRight = q.answer === oi;
                          const state = quizChecked
                            ? isRight
                              ? 'right'
                              : isChosen
                                ? 'wrong'
                                : 'idle'
                            : isChosen
                              ? 'chosen'
                              : 'idle';
                          return (
                            <button
                              key={oi}
                              onClick={() =>
                                !quizChecked && setAnswers((a) => ({ ...a, [qi]: oi }))
                              }
                              disabled={quizChecked}
                              className={`flex w-full items-start gap-3 rounded-md border px-3.5 py-2.5 text-left text-[13.5px] transition-colors ${
                                state === 'right'
                                  ? 'border-moss/45 bg-moss/[0.07] text-ink'
                                  : state === 'wrong'
                                    ? 'border-clay/45 bg-clay/[0.05] text-ink'
                                    : state === 'chosen'
                                      ? 'border-ink/30 bg-paper text-ink'
                                      : 'border-line bg-paper text-ink-soft hover:border-ink/20'
                              }`}
                            >
                              <span className="mt-[3px] font-mono text-[10px] text-faint">
                                {String.fromCharCode(65 + oi)}
                              </span>
                              <span className="font-mono text-[12.5px] leading-relaxed">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                      {quizChecked && (
                        <p className="mt-3 border-t border-line-soft pt-3 text-[12.5px] leading-relaxed text-muted">
                          {q.explain}
                        </p>
                      )}
                    </div>
                  );
                })}

                <div className="flex flex-wrap items-center gap-3">
                  {!quizChecked ? (
                    <button
                      onClick={checkQuiz}
                      disabled={Object.keys(answers).length < questions.length}
                      className="rounded-full bg-ink px-5 py-2.5 text-[13px] text-paper transition-opacity hover:opacity-88 disabled:opacity-35"
                    >
                      Check answers
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setQuizChecked(false);
                        setAnswers({});
                        setPassed(null);
                        setCelebrate(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2.5 text-[13px] text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
                    >
                      <RotateCcw size={12} /> Try again
                    </button>
                  )}
                  {quizChecked && (
                    <span
                      className={`text-[13px] ${passed ? 'text-moss' : 'text-clay'}`}
                    >
                      {questions.filter((q, i) => answers[i] === q.answer).length}/
                      {questions.length} correct
                      {passed ? ' — nice.' : ' — review the notes and retry.'}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
                    {language.filename}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setCode(lesson.starter_code || '');
                        setResult(null);
                        setPassed(null);
                        setRunError(null);
                      }}
                      className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
                    >
                      <RotateCcw size={11} /> Reset
                    </button>
                    <button
                      onClick={() => void run()}
                      disabled={running}
                      className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[12.5px] text-paper transition-opacity hover:opacity-88 disabled:opacity-50"
                    >
                      {running ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={11} />
                      )}
                      Run
                    </button>
                  </div>
                </div>

                <CodeEditor
                  value={code}
                  onChange={setCode}
                  lang={language.slug}
                  onRun={() => void run()}
                  minHeight={320}
                />

                <Console
                  result={result}
                  error={runError}
                  running={running}
                  expected={lesson.expected_output}
                  passed={passed}
                />
              </div>
            )}

            <AnimatePresence>
              {celebrate && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-moss/35 bg-moss/[0.06] px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-moss/15 text-moss">
                      <Check size={14} />
                    </span>
                    <div>
                      <p className="text-[13.5px] text-ink">
                        {celebrate.xp > 0 ? `Passed · +${celebrate.xp} XP` : 'Passed again'}
                      </p>
                      <p className="text-[12px] text-muted">
                        {next ? `Up next: ${next.title}` : 'That was the last lesson in this track.'}
                      </p>
                    </div>
                  </div>
                  {next ? (
                    <button
                      onClick={() => navigate(`/learn/${language.slug}/${next.slug}`)}
                      className="group inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12.5px] text-paper transition-opacity hover:opacity-88"
                    >
                      Next lesson
                      <ArrowRight
                        size={12}
                        className="transition-transform duration-300 group-hover:translate-x-0.5"
                      />
                    </button>
                  ) : (
                    <Link
                      to={`/learn/${language.slug}`}
                      className="rounded-full bg-ink px-4 py-2 text-[12.5px] text-paper transition-opacity hover:opacity-88"
                    >
                      Back to track
                    </Link>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {passed === false && !celebrate && (
              <p className="mt-4 text-[12.5px] text-muted">
                Not quite — compare your output with what's expected.{' '}
                {hints.length > 0 && hintsOpen < hints.length && (
                  <button
                    onClick={() => setHintsOpen((v) => v + 1)}
                    className="text-clay underline decoration-clay/25 underline-offset-2 hover:decoration-clay"
                  >
                    Take a hint
                  </button>
                )}
              </p>
            )}

            {profile && (profile.hearts ?? 5) === 0 && (
              <p className="mt-3 text-[12.5px] text-clay">
                Out of hearts — they refill the moment you pass a lesson. Keep going, nothing is
                locked.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
          {prev ? (
            <Link
              to={`/learn/${language.slug}/${prev.slug}`}
              className="group flex min-w-0 items-center gap-2.5 text-left"
            >
              <ArrowLeft
                size={13}
                className="shrink-0 text-faint transition-all duration-300 group-hover:-translate-x-0.5 group-hover:text-ink"
              />
              <span className="min-w-0">
                <span className="block font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
                  Previous
                </span>
                <span className="block truncate text-[13px] text-ink-soft group-hover:text-ink">
                  {prev.title}
                </span>
              </span>
            </Link>
          ) : (
            <span />
          )}

          {next ? (
            <button
              onClick={() => {
                if (!alreadyDone && passed !== true) {
                  pushToast({
                    title: 'Finish this one first',
                    body: 'Run your code and pass the check to unlock the next lesson.',
                    glyph: '→',
                  });
                  return;
                }
                navigate(`/learn/${language.slug}/${next.slug}`);
              }}
              className="group flex min-w-0 items-center gap-2.5 text-right"
            >
              <span className="min-w-0">
                <span className="block font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
                  Next
                </span>
                <span className="block truncate text-[13px] text-ink-soft group-hover:text-ink">
                  {next.title}
                </span>
              </span>
              <ArrowRight
                size={13}
                className="shrink-0 text-faint transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-ink"
              />
            </button>
          ) : (
            <Link
              to={`/learn/${language.slug}`}
              className="text-[13px] text-ink-soft transition-colors hover:text-ink"
            >
              Track overview →
            </Link>
          )}
        </div>
      </div>

      <p className="pb-10 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
        {plural(lesson.xp, 'XP')} on completion · ⌘/Ctrl + ↵ to run
      </p>
    </div>
  );
}
