import { CheckCircle2, CircleAlert, Loader2, Terminal } from 'lucide-react';
import type { RunResult } from '../lib/types';
import { normalizeOut } from '../lib/format';

type Props = {
  result: RunResult | null;
  error: string | null;
  running: boolean;
  expected?: string;
  passed?: boolean | null;
};

export default function Console({ result, error, running, expected, passed }: Props) {
  const body = (() => {
    if (running) {
      return (
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          <Loader2 size={13} className="animate-spin" />
          Compiling and running…
        </div>
      );
    }
    if (error) {
      return <p className="font-mono text-[12.5px] leading-relaxed text-clay">{error}</p>;
    }
    if (!result) {
      return (
        <p className="text-[12.5px] text-faint">
          Output appears here. Press <span className="font-mono text-muted">⌘/Ctrl + ↵</span> to run.
        </p>
      );
    }

    const compile = result.compileOutput?.trim();
    const stderr = result.stderr?.trim();
    const stdout = result.stdout;

    return (
      <div className="space-y-3">
        {compile && (
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-clay">
              Compiler
            </p>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-clay">
              {compile}
            </pre>
          </div>
        )}
        {stderr && (
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-clay">
              Runtime
            </p>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-clay">
              {stderr}
            </pre>
          </div>
        )}
        {stdout ? (
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              stdout
            </p>
            <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-ink">
              {stdout.replace(/\n$/, '')}
            </pre>
          </div>
        ) : (
          !compile &&
          !stderr && <p className="font-mono text-[12px] text-faint">(no output)</p>
        )}
        {passed === false && expected && normalizeOut(expected) && (
          <div className="rounded border border-line bg-paper/70 p-3">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              Expected
            </p>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-soft">
              {normalizeOut(expected)}
            </pre>
          </div>
        )}
      </div>
    );
  })();

  return (
    <div className="rounded-lg border border-line bg-sunk/60">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <Terminal size={11} /> Console
        </span>
        <span className="flex items-center gap-3 font-mono text-[10px] text-faint">
          {result?.time && <span>{result.time}s</span>}
          {result?.memory ? <span>{Math.round(result.memory / 1024)} MB</span> : null}
          {passed === true && (
            <span className="flex items-center gap-1 text-moss">
              <CheckCircle2 size={11} /> match
            </span>
          )}
          {passed === false && (
            <span className="flex items-center gap-1 text-clay">
              <CircleAlert size={11} /> mismatch
            </span>
          )}
        </span>
      </div>
      <div className="max-h-64 overflow-auto px-4 py-3">{body}</div>
    </div>
  );
}
