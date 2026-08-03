import type { ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]*`|\*\*[^*]+\*\*)/g).filter((p) => p !== '');
  return parts.map((p, i) => {
    if (p.length > 1 && p.startsWith('`') && p.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded border border-line bg-sunk px-1 py-[1px] font-mono text-[0.88em] text-clay"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="font-medium text-ink">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function Prose({ text, className }: { text: string; className?: string }) {
  const blocks = (text || '').split(/\n\n+/).filter(Boolean);

  return (
    <div className={`space-y-4 text-[14.5px] leading-[1.75] text-ink-soft ${className || ''}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={bi} className="space-y-1.5">
              {lines.map((l, li) => (
                <li key={li} className="flex gap-2.5">
                  <span className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-faint" />
                  <span>{inline(l.trim().slice(2))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={bi}>{inline(block.replace(/\n/g, ' '))}</p>;
      })}
    </div>
  );
}
