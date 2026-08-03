import { useMemo } from 'react';
import { TOKEN_CLASS, tokenize } from '../lib/highlight';

type Props = {
  code: string;
  lang: string;
  showLineNumbers?: boolean;
  className?: string;
};

export default function CodeBlock({ code, lang, showLineNumbers = true, className }: Props) {
  const lines = useMemo(() => tokenize(code || '', lang), [code, lang]);

  return (
    <div
      className={`overflow-x-auto rounded-lg border border-line bg-surface font-mono text-[12.5px] leading-[1.7] ${className || ''}`}
    >
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((toks, i) => (
            <tr key={i}>
              {showLineNumbers && (
                <td className="w-9 select-none border-r border-line-soft py-0 pr-2 text-right align-top text-[11px] text-faint">
                  {i + 1}
                </td>
              )}
              <td className="whitespace-pre py-0 pl-3 pr-4 align-top">
                {toks.length === 0 ? (
                  <span> </span>
                ) : (
                  toks.map((t, j) => (
                    <span key={j} className={TOKEN_CLASS[t.t]}>
                      {t.v}
                    </span>
                  ))
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
