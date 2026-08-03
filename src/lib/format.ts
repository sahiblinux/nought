export const LEVEL_STEP = 150;

export const levelOf = (xp: number) => Math.floor((xp || 0) / LEVEL_STEP) + 1;
export const levelFloor = (xp: number) => (levelOf(xp) - 1) * LEVEL_STEP;
export const levelProgress = (xp: number) => ((xp || 0) % LEVEL_STEP) / LEVEL_STEP;

const RANKS = [
  'Nought',
  'Novice',
  'Apprentice',
  'Journeyer',
  'Artisan',
  'Adept',
  'Craftsman',
  'Engineer',
  'Sage',
  'Luminary',
  'Architect',
];

export const rankOf = (xp: number) => RANKS[Math.min(levelOf(xp) - 1, RANKS.length - 1)];

export const normalizeOut = (s: string) =>
  (s || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '')
    .trim();

export function gradeOutput(actual: string, expected: string, mode = 'exact') {
  const a = normalizeOut(actual);
  const e = normalizeOut(expected);
  if (!e) return true;
  if (mode === 'contains') {
    return e
      .split('\n')
      .filter(Boolean)
      .every((line) => a.includes(line.trim()));
  }
  return a === e;
}

export const plural = (n: number, one: string, many?: string) =>
  `${n} ${n === 1 ? one : many || `${one}s`}`;

export function timeAgo(iso: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
