import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { publicApi } from '../lib/api';
import { useLearner } from '../contexts/LearnerContext';
import { levelOf, plural, rankOf } from '../lib/format';
import Footer from '../components/Footer';
import { ErrorNote, Skeleton } from '../components/Loading';

type Row = {
  id: string;
  display_name: string;
  xp: number;
  streak: number;
  lessons_done: number;
  is_me: boolean;
};

export default function Leaderboard() {
  const { profile } = useLearner();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await publicApi<Row[]>('/api/leaderboard'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const myRank = rows.findIndex((r) => r.is_me);

  return (
    <div>
      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted">
          All learners
        </p>
        <h1 className="mt-4 font-serif text-[2.3rem] leading-none tracking-tight text-ink sm:text-[2.8rem]">
          Leaderboard
        </h1>
        <p className="mt-4 max-w-lg text-[14.5px] leading-relaxed text-ink-soft">
          Ranked by total XP earned across every track. Finishing lessons on the first attempt and
          keeping a daily streak is the fastest way up.
        </p>

        {error && (
          <div className="mt-8">
            <ErrorNote message={error} onRetry={load} />
          </div>
        )}

        {loading ? (
          <div className="mt-10 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-10 rounded-lg border border-line bg-surface p-6">
            <p className="text-[14px] text-ink">Nobody has scored yet.</p>
            <p className="mt-1 text-[13px] text-muted">
              Clear a lesson and you'll be first on the board.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-full bg-ink px-4 py-2 text-[12.5px] text-paper transition-opacity hover:opacity-88"
            >
              Pick a language
            </Link>
          </div>
        ) : (
          <>
            {profile && myRank === -1 && (
              <p className="mt-8 text-[13px] text-muted">
                You're not on the board yet — clear one lesson to appear.
              </p>
            )}
            <ol className="mt-10 divide-y divide-line-soft border-y border-line">
              {rows.map((r, i) => {
                const me = r.is_me;
                return (
                  <li
                    key={r.id}
                    className={`flex items-center gap-4 py-4 ${me ? 'bg-clay/[0.035] px-3' : ''}`}
                  >
                    <span
                      className={`w-7 shrink-0 font-mono text-[12px] ${
                        i < 3 ? 'text-clay' : 'text-faint'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-ink">
                        {r.display_name || 'Learner'}
                        {me && (
                          <span className="ml-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-clay">
                            you
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {rankOf(r.xp)} · Lv{levelOf(r.xp)} · {plural(r.lessons_done, 'lesson')}
                      </p>
                    </div>
                    {r.streak > 0 && (
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-clay">
                        <Flame size={11} /> {r.streak}
                      </span>
                    )}
                    <span className="w-16 shrink-0 text-right font-mono text-[13px] text-ink">
                      {r.xp}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
