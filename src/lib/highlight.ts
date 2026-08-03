export type TokenType =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'type'
  | 'builtin'
  | 'func'
  | 'macro'
  | 'punct'
  | 'meta';

export type Token = { t: TokenType; v: string };

type Spec = {
  keywords: string[];
  types: string[];
  builtins: string[];
  line: string[];
  block?: [string, string];
  triple?: boolean;
  preproc?: boolean;
  bangMacro?: boolean;
  lifetime?: boolean;
};

const SPECS: Record<string, Spec> = {
  python: {
    keywords:
      'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(
        ' '
      ),
    types: 'int float str bool list dict tuple set bytes complex frozenset object type'.split(' '),
    builtins:
      'print len range input abs all any enumerate zip map filter sorted sum min max round open isinstance format reversed join split append pop items keys values self super'.split(
        ' '
      ),
    line: ['#'],
    triple: true,
  },
  c: {
    keywords:
      'auto break case const continue default do else enum extern for goto if inline register restrict return sizeof static struct switch typedef union volatile while _Bool'.split(
        ' '
      ),
    types: 'char double float int long short signed unsigned void size_t FILE'.split(' '),
    builtins:
      'printf scanf malloc calloc realloc free strlen strcpy strncpy strcmp strcat memset memcpy fopen fclose fgets puts putchar getchar exit NULL'.split(
        ' '
      ),
    line: ['//'],
    block: ['/*', '*/'],
    preproc: true,
  },
  cpp: {
    keywords:
      'alignas alignof and auto break case catch class const constexpr continue decltype default delete do else enum explicit export extern for friend goto if inline mutable namespace new noexcept nullptr operator override private protected public return sizeof static static_cast dynamic_cast const_cast reinterpret_cast struct switch template this throw try typedef typeid typename union using virtual volatile while true false'.split(
        ' '
      ),
    types:
      'bool char double float int long short signed unsigned void size_t string vector map set pair array wstring uint8_t int64_t ostream istream'.split(
        ' '
      ),
    builtins:
      'std cout cin cerr endl push_back pop_back size begin end sort find max min swap make_pair to_string printf getline emplace_back at count accumulate reverse'.split(
        ' '
      ),
    line: ['//'],
    block: ['/*', '*/'],
    preproc: true,
  },
  java: {
    keywords:
      'abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try var void volatile while true false null record sealed yield'.split(
        ' '
      ),
    types:
      'boolean byte char double float int long short String Integer Double Boolean Object List ArrayList Map HashMap Set HashSet Arrays Math System Scanner StringBuilder Optional Character Long'.split(
        ' '
      ),
    builtins:
      'println print printf out length size add get put contains equals toString valueOf charAt substring split trim format sqrt pow abs max min sort stream forEach'.split(
        ' '
      ),
    line: ['//'],
    block: ['/*', '*/'],
  },
  rust: {
    keywords:
      'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return Self self static struct super trait true type unsafe use where while'.split(
        ' '
      ),
    types:
      'bool char f32 f64 i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize str String Vec Option Some None Result Ok Err Box HashMap HashSet Rc RefCell Arc Mutex Iterator Clone Copy Debug Display Default'.split(
        ' '
      ),
    builtins:
      'println print format vec panic assert assert_eq write writeln push pop len iter into_iter collect unwrap expect map filter sum min max sort push_str to_string as_str new from matches'.split(
        ' '
      ),
    line: ['//'],
    block: ['/*', '*/'],
    bangMacro: true,
    lifetime: true,
  },
};

const isWordStart = (c: string) => /[A-Za-z_$]/.test(c);
const isWord = (c: string) => /[A-Za-z0-9_$]/.test(c);
const isDigit = (c: string) => /[0-9]/.test(c);

export function tokenize(code: string, lang: string): Token[][] {
  const spec = SPECS[lang] || SPECS.python;
  const kw = new Set(spec.keywords);
  const ty = new Set(spec.types);
  const bi = new Set(spec.builtins);

  const tokens: Token[] = [];
  let i = 0;
  const n = code.length;
  let atLineStart = true;

  const push = (t: TokenType, v: string) => {
    if (!v) return;
    tokens.push({ t, v });
  };

  while (i < n) {
    const c = code[i];

    if (c === '\n') {
      push('plain', '\n');
      i++;
      atLineStart = true;
      continue;
    }

    if (c === ' ' || c === '\t') {
      let j = i;
      while (j < n && (code[j] === ' ' || code[j] === '\t')) j++;
      push('plain', code.slice(i, j));
      i = j;
      continue;
    }

    if (spec.preproc && atLineStart && c === '#') {
      let j = i;
      while (j < n && code[j] !== '\n') j++;
      push('macro', code.slice(i, j));
      i = j;
      continue;
    }

    let matchedLine = false;
    for (const lc of spec.line) {
      if (code.startsWith(lc, i)) {
        let j = i;
        while (j < n && code[j] !== '\n') j++;
        push('comment', code.slice(i, j));
        i = j;
        matchedLine = true;
        break;
      }
    }
    if (matchedLine) {
      atLineStart = false;
      continue;
    }

    if (spec.block && code.startsWith(spec.block[0], i)) {
      const end = code.indexOf(spec.block[1], i + spec.block[0].length);
      const j = end === -1 ? n : end + spec.block[1].length;
      push('comment', code.slice(i, j));
      i = j;
      atLineStart = false;
      continue;
    }

    if (spec.triple && (code.startsWith('"""', i) || code.startsWith("'''", i))) {
      const d = code.slice(i, i + 3);
      const end = code.indexOf(d, i + 3);
      const j = end === -1 ? n : end + 3;
      push('string', code.slice(i, j));
      i = j;
      atLineStart = false;
      continue;
    }

    if (spec.lifetime && c === "'" && i + 1 < n && isWordStart(code[i + 1])) {
      const after = code[i + 2];
      if (after !== "'") {
        let j = i + 1;
        while (j < n && isWord(code[j])) j++;
        push('meta', code.slice(i, j));
        i = j;
        atLineStart = false;
        continue;
      }
    }

    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (code[j] === '\\') {
          j += 2;
          continue;
        }
        if (code[j] === c) {
          j++;
          break;
        }
        if (code[j] === '\n') break;
        j++;
      }
      push('string', code.slice(i, j));
      i = j;
      atLineStart = false;
      continue;
    }

    if (isDigit(c) || (c === '.' && isDigit(code[i + 1] || ''))) {
      let j = i;
      while (j < n && /[0-9a-fA-FxXoObB_.eE+\-']/.test(code[j])) {
        if ((code[j] === '+' || code[j] === '-') && !/[eE]/.test(code[j - 1] || '')) break;
        if (code[j] === "'") break;
        j++;
      }
      let k = j;
      while (k < n && /[uUlLfF]/.test(code[k])) k++;
      push('number', code.slice(i, k));
      i = k;
      atLineStart = false;
      continue;
    }

    if (isWordStart(c)) {
      let j = i;
      while (j < n && isWord(code[j])) j++;
      let word = code.slice(i, j);
      let end = j;
      if (spec.bangMacro && code[j] === '!') {
        word = word + '!';
        end = j + 1;
      }
      const bare = word.replace('!', '');
      let nx = end;
      while (nx < n && code[nx] === ' ') nx++;
      if (kw.has(bare)) push('keyword', word);
      else if (ty.has(bare)) push('type', word);
      else if (bi.has(bare)) push('builtin', word);
      else if (code[nx] === '(' || word.endsWith('!')) push('func', word);
      else if (/^[A-Z]/.test(bare) && bare.length > 1) push('type', word);
      else push('plain', word);
      i = end;
      atLineStart = false;
      continue;
    }

    push('punct', c);
    i++;
    atLineStart = false;
  }

  const lines: Token[][] = [[]];
  for (const tk of tokens) {
    if (tk.v === '\n') {
      lines.push([]);
      continue;
    }
    const parts = tk.v.split('\n');
    parts.forEach((p, idx) => {
      if (idx > 0) lines.push([]);
      if (p) lines[lines.length - 1].push({ t: tk.t, v: p });
    });
  }
  return lines;
}

export const TOKEN_CLASS: Record<TokenType, string> = {
  plain: 'text-ink',
  comment: 'text-faint italic',
  string: 'text-moss',
  number: 'text-slate',
  keyword: 'text-clay',
  type: 'text-slate',
  builtin: 'text-ink-soft',
  func: 'text-ink font-medium',
  macro: 'text-clay/70',
  punct: 'text-muted',
  meta: 'text-slate/80',
};
