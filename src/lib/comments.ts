export const COMMENT_PREFIX: Record<string, string> = {
  python: '# ',
  c: '// ',
  cpp: '// ',
  java: '// ',
  rust: '// ',
};

export const INDENT = '    ';

export function opensBlock(line: string, lang: string) {
  const t = line.trimEnd();
  if (lang === 'python') return t.endsWith(':');
  return t.endsWith('{') || t.endsWith('(') || t.endsWith('[');
}
