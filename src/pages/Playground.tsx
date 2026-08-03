import { useCallback, useEffect, useState } from 'react';
import { Loader2, Play, RotateCcw } from 'lucide-react';
import { publicApi, postJson } from '../lib/api';
import type { Language, RunResult } from '../lib/types';
import CodeEditor from '../components/CodeEditor';
import Console from '../components/Console';
import Footer from '../components/Footer';
import { ErrorNote, Skeleton } from '../components/Loading';

const TEMPLATES: Record<string, string> = {
  python: `# Python scratchpad
names = ["ada", "grace", "alan"]

for i, name in enumerate(names, start=1):
    print(f"{i}. {name.title()}")

total = sum(len(n) for n in names)
print("letters:", total)
`,
  c: `#include <stdio.h>

int main(void) {
    int values[] = {4, 8, 15, 16, 23, 42};
    int n = sizeof(values) / sizeof(values[0]);
    int sum = 0;

    for (int i = 0; i < n; i++) {
        sum += values[i];
    }

    printf("sum = %d\\n", sum);
    printf("mean = %.2f\\n", (double)sum / n);
    return 0;
}
`,
  cpp: `#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

int main() {
    std::vector<std::string> words{"delta", "alpha", "charlie", "bravo"};
    std::sort(words.begin(), words.end());

    for (const std::string& w : words) {
        std::cout << w << '\\n';
    }
    std::cout << "count: " << words.size() << '\\n';
    return 0;
}
`,
  java: `public class Main {
    static int fib(int n) {
        return n < 2 ? n : fib(n - 1) + fib(n - 2);
    }

    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            sb.append(fib(i));
            if (i < 9) sb.append(", ");
        }
        System.out.println(sb.toString());
    }
}
`,
  rust: `fn main() {
    let nums = vec![3, 7, 2, 9, 4];

    let largest = nums.iter().max().unwrap();
    let total: i32 = nums.iter().sum();

    println!("largest: {}", largest);
    println!("total: {}", total);

    let doubled: Vec<i32> = nums.iter().map(|n| n * 2).collect();
    println!("doubled: {:?}", doubled);
}
`,
};

const STORE = 'nought:playground';

export default function Playground() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [active, setActive] = useState('python');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [stdin, setStdin] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const langs = await publicApi<Language[]>('/api/languages');
      setLanguages(langs);
      const saved = JSON.parse(localStorage.getItem(STORE) || '{}') as Record<string, string>;
      const initial: Record<string, string> = {};
      for (const l of langs) initial[l.slug] = saved[l.slug] ?? TEMPLATES[l.slug] ?? '';
      setCodes(initial);
      if (langs.length && !langs.some((l) => l.slug === 'python')) setActive(langs[0].slug);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load languages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!Object.keys(codes).length) return;
    const t = window.setTimeout(() => localStorage.setItem(STORE, JSON.stringify(codes)), 700);
    return () => window.clearTimeout(t);
  }, [codes]);

  const run = useCallback(async () => {
    const code = codes[active] || '';
    if (!code.trim()) {
      setError('Write something first.');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await postJson<RunResult>('/api/run', { language: active, code, stdin }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run your code.');
    } finally {
      setRunning(false);
    }
  }, [codes, active, stdin]);

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

  const current = languages.find((l) => l.slug === active);

  return (
    <div>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted">
          Free-form scratchpad
        </p>
        <h1 className="mt-4 font-serif text-[2.3rem] leading-none tracking-tight text-ink sm:text-[2.8rem]">
          Playground
        </h1>
        <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-ink-soft">
          Five real compilers, no lesson attached. Nothing is graded here — write whatever you want,
          feed it stdin, and read the output. Your buffers are kept per language in this browser.
        </p>

        {loadError && (
          <div className="mt-8">
            <ErrorNote message={loadError} onRetry={load} />
          </div>
        )}

        {loading ? (
          <div className="mt-10 space-y-4">
            <Skeleton className="h-9 w-80" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <div className="mt-10">
            <div className="flex flex-wrap items-center gap-2">
              {languages.map((l) => (
                <button
                  key={l.slug}
                  onClick={() => {
                    setActive(l.slug);
                    setResult(null);
                    setError(null);
                  }}
                  className={`rounded-full border px-4 py-1.5 text-[12.5px] transition-colors ${
                    active === l.slug
                      ? 'border-ink bg-ink text-paper'
                      : 'border-line bg-surface text-ink-soft hover:border-ink/25 hover:text-ink'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
                    {current?.filename || 'main'}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setCodes((c) => ({ ...c, [active]: TEMPLATES[active] || '' }));
                        setResult(null);
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
                    >
                      <RotateCcw size={11} /> Template
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
                  value={codes[active] || ''}
                  onChange={(v) => setCodes((c) => ({ ...c, [active]: v }))}
                  lang={active}
                  onRun={() => void run()}
                  minHeight={420}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="stdin"
                    className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted"
                  >
                    stdin (optional)
                  </label>
                  <textarea
                    id="stdin"
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    rows={4}
                    spellCheck={false}
                    placeholder="Lines fed to your program's input…"
                    className="mt-1.5 w-full resize-y rounded-lg border border-line bg-surface px-3.5 py-2.5 font-mono text-[12.5px] text-ink placeholder:text-faint focus:border-ink/30"
                  />
                </div>

                <Console result={result} error={error} running={running} passed={null} />

                {current && (
                  <dl className="rounded-lg border border-line bg-surface p-4">
                    <div className="flex justify-between gap-4 border-b border-line-soft pb-2">
                      <dt className="text-[12.5px] text-muted">Language</dt>
                      <dd className="text-[12.5px] text-ink">{current.name}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-line-soft py-2">
                      <dt className="text-[12.5px] text-muted">Paradigm</dt>
                      <dd className="text-[12.5px] text-ink">{current.paradigm}</dd>
                    </div>
                    <div className="flex justify-between gap-4 pt-2">
                      <dt className="text-[12.5px] text-muted">Since</dt>
                      <dd className="text-[12.5px] text-ink">{current.born}</dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
