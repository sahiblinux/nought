import { useEffect, useMemo, useRef } from 'react';
import { TOKEN_CLASS, tokenize } from '../lib/highlight';
import { COMMENT_PREFIX, INDENT, opensBlock } from '../lib/comments';

type Props = {
  value: string;
  onChange: (v: string) => void;
  lang: string;
  onRun?: () => void;
  minHeight?: number;
  className?: string;
};

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };

const SHARED: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  lineHeight: '22px',
  padding: '14px 16px 14px 0',
  tabSize: 4,
  whiteSpace: 'pre',
  wordWrap: 'normal',
  letterSpacing: '0',
  border: 'none',
  margin: 0,
};

export default function CodeEditor({
  value,
  onChange,
  lang,
  onRun,
  minHeight = 300,
  className,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);

  const lines = useMemo(() => tokenize(value, lang), [value, lang]);

  useEffect(() => {
    if (pendingSel.current && taRef.current) {
      const [a, b] = pendingSel.current;
      taRef.current.setSelectionRange(a, b);
      pendingSel.current = null;
    }
  }, [value]);

  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

  const apply = (next: string, selStart: number, selEnd = selStart) => {
    pendingSel.current = [selStart, selEnd];
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === 'Enter') {
      e.preventDefault();
      onRun?.();
      return;
    }

    if (mod && (e.key === '/' || e.code === 'Slash')) {
      e.preventDefault();
      const prefix = COMMENT_PREFIX[lang] || '// ';
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = value.indexOf('\n', end);
      const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
      const chunk = value.slice(lineStart, lineEnd);
      const rows = chunk.split('\n');
      const trimmed = prefix.trim();
      const allCommented = rows.every((r) => !r.trim() || r.trimStart().startsWith(trimmed));
      const updated = rows
        .map((r) => {
          if (!r.trim()) return r;
          if (allCommented) {
            const idx = r.indexOf(trimmed);
            return r.slice(0, idx) + r.slice(idx + trimmed.length).replace(/^ /, '');
          }
          const lead = r.match(/^\s*/)?.[0] ?? '';
          return lead + prefix + r.slice(lead.length);
        })
        .join('\n');
      const next = value.slice(0, lineStart) + updated + value.slice(lineEnd);
      apply(next, lineStart, lineStart + updated.length);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (start !== end && value.slice(start, end).includes('\n')) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const chunk = value.slice(lineStart, end);
        const rows = chunk.split('\n');
        const updated = e.shiftKey
          ? rows.map((r) => r.replace(new RegExp(`^ {1,${INDENT.length}}`), '')).join('\n')
          : rows.map((r) => INDENT + r).join('\n');
        const next = value.slice(0, lineStart) + updated + value.slice(end);
        apply(next, lineStart, lineStart + updated.length);
        return;
      }
      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lead = value.slice(lineStart, start);
        const cut = Math.min(INDENT.length, lead.length - lead.trimStart().length);
        if (cut > 0) {
          const next = value.slice(0, start - cut) + value.slice(start);
          apply(next, start - cut);
        }
        return;
      }
      const next = value.slice(0, start) + INDENT + value.slice(end);
      apply(next, start + INDENT.length);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.slice(lineStart, start);
      const lead = currentLine.match(/^[ \t]*/)?.[0] ?? '';
      const extra = opensBlock(currentLine, lang) ? INDENT : '';
      const after = value.slice(end);
      const closesNext = /^[ \t]*[)}\]]/.test(after);

      if (extra && closesNext && lang !== 'python') {
        const insert = `\n${lead}${INDENT}\n${lead}`;
        const next = value.slice(0, start) + insert + after;
        apply(next, start + 1 + lead.length + INDENT.length);
        return;
      }
      const insert = `\n${lead}${extra}`;
      const next = value.slice(0, start) + insert + after;
      apply(next, start + insert.length);
      return;
    }

    if (e.key === 'Backspace' && start === end) {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lead = value.slice(lineStart, start);
      if (lead.length > 0 && /^[ ]+$/.test(lead) && lead.length % INDENT.length === 0) {
        e.preventDefault();
        const next = value.slice(0, start - INDENT.length) + value.slice(start);
        apply(next, start - INDENT.length);
        return;
      }
      const closing = PAIRS[value[start - 1]];
      if (closing && value[start] === closing) {
        e.preventDefault();
        const next = value.slice(0, start - 1) + value.slice(start + 1);
        apply(next, start - 1);
        return;
      }
      return;
    }

    if (PAIRS[e.key]) {
      const close = PAIRS[e.key];
      if (start !== end) {
        e.preventDefault();
        const sel = value.slice(start, end);
        const next = value.slice(0, start) + e.key + sel + close + value.slice(end);
        apply(next, start + 1, end + 1);
        return;
      }
      const nextChar = value[start] || '';
      if ((e.key === '"' || e.key === "'") && (/[\w"']/.test(nextChar) || /[\w]/.test(value[start - 1] || ''))) {
        return;
      }
      if (nextChar && !/[\s)}\]:;,.]/.test(nextChar)) return;
      e.preventDefault();
      const next = value.slice(0, start) + e.key + close + value.slice(end);
      apply(next, start + 1);
      return;
    }

    if ([')', ']', '}', '"', "'"].includes(e.key) && start === end && value[start] === e.key) {
      e.preventDefault();
      apply(value, start + 1);
    }
  };

  return (
    <div
      className={`relative flex overflow-hidden rounded-lg border border-line bg-surface ${className || ''}`}
      style={{ minHeight }}
    >
      <div
        ref={gutterRef}
        aria-hidden
        className="select-none overflow-hidden border-r border-line-soft bg-paper/60 text-right"
        style={{
          ...SHARED,
          padding: '14px 8px 14px 10px',
          width: 44,
          color: 'var(--color-faint)',
          fontSize: '11.5px',
        }}
      >
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>

      <div className="relative flex-1">
        <pre
          ref={preRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ ...SHARED, paddingLeft: 14 }}
        >
          <code>
            {lines.map((toks, i) => (
              <span key={i}>
                {toks.map((t, j) => (
                  <span key={j} className={TOKEN_CLASS[t.t]}>
                    {t.v}
                  </span>
                ))}
                {i < lines.length - 1 ? '\n' : ''}
              </span>
            ))}
          </code>
        </pre>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent caret-clay"
          style={{ ...SHARED, paddingLeft: 14 }}
        />
      </div>
    </div>
  );
}
