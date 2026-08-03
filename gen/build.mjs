import { runLocal, norm } from './runner.mjs';

export const XP_BY_TIER = { foundation: 12, core: 16, applied: 22, advanced: 28 };
export const DRILL_DISCOUNT = 4;

const FILE_OF = { python: 'main.py', c: 'main.c', cpp: 'main.cpp', java: 'Main.java', rust: 'main.rs' };

export function scaffold(lang, given = '') {
  const g = given.trim();
  if (lang === 'python') {
    return g ? `${g}\n\n# your code here\n` : '# your code here\n';
  }
  if (lang === 'c') {
    const body = g ? g.split('\n').map((l) => '    ' + l).join('\n') + '\n' : '';
    return `#include <stdio.h>\n\nint main(void) {\n${body}    // your code here\n    return 0;\n}\n`;
  }
  if (lang === 'cpp') {
    const body = g ? g.split('\n').map((l) => '    ' + l).join('\n') + '\n' : '';
    return `#include <iostream>\n\nint main() {\n${body}    // your code here\n}\n`;
  }
  if (lang === 'java') {
    const body = g ? g.split('\n').map((l) => '        ' + l).join('\n') + '\n' : '';
    return `public class Main {\n    public static void main(String[] args) {\n${body}        // your code here\n    }\n}\n`;
  }
  if (lang === 'rust') {
    const body = g ? g.split('\n').map((l) => '    ' + l).join('\n') + '\n' : '';
    return `fn main() {\n${body}    // your code here\n}\n`;
  }
  throw new Error('scaffold: unknown lang ' + lang);
}

const PRACTICE_INTRO = {
  python:
    'Practice problem. Nothing new is introduced here \u2014 this drills the ideas from this module until they are automatic. Read the task, plan the shape of the code in your head, then write it.',
  c: 'Practice problem. No new syntax here \u2014 this is repetition of this module\u2019s ideas so they become second nature. Remember your semicolons and format specifiers.',
  cpp: 'Practice problem. No new syntax \u2014 this drills the current module. Reach for the standard library where it saves you effort.',
  java: 'Practice problem. No new syntax \u2014 this exercises the current module. Keep everything inside the Main class.',
  rust: 'Practice problem. No new syntax \u2014 this drills the current module. Let the compiler guide you; its messages are unusually good.',
};

const GENERIC_HINTS = {
  python: 'Print exactly the lines shown \u2014 spacing and punctuation are compared character for character.',
  c: 'Match the expected output exactly, including every space and newline (\\n).',
  cpp: 'Match the expected output exactly, including every space and newline.',
  java: 'Match the expected output exactly. println adds the newline for you.',
  rust: 'Match the expected output exactly. println! adds the newline for you.',
};

/**
 * A lesson spec:
 *   { slug, title, subtitle, concept, example, note, task, given?, starter?, solution, hint?|hints?, xp?, kind? }
 * Drill spec (kind: 'drill'):
 *   { slug, title, task, given?, solution, hint? }
 */
export async function buildLessons({ lang, module: mod, tier, specs, startOrder }) {
  const out = [];
  let order = startOrder;

  for (const s of specs) {
    if (s.kind === 'quiz') {
      out.push({
        language_slug: lang,
        module_slug: mod,
        slug: s.slug,
        title: s.title,
        subtitle: s.subtitle || 'Check what stuck before moving on',
        kind: 'quiz',
        concept:
          s.concept ||
          'A short checkpoint. Every answer follows from the lessons in this module \u2014 nothing new is being tested. You can retry as many times as you like.',
        example_code: '',
        example_note: '',
        task: 'Answer every question, then check your answers.',
        starter_code: '',
        solution_code: '',
        expected_output: '',
        check_mode: 'exact',
        hints: null,
        quiz: { questions: s.questions },
        xp: 20,
        sort_order: order++,
      });
      continue;
    }

    const isDrill = s.kind === 'drill';

    // Guard: '%%' is only meaningful inside a printf format string. Outside one
    // it is almost always a doubled modulo operator, which fails to compile.
    if ((lang === 'c' || lang === 'cpp') && /[\w)\s]%%\s*[\w(]/.test(s.solution)) {
      const suspect = s.solution
        .split('\n')
        .filter((l) => /%%/.test(l) && !/"[^"]*%%[^"]*"/.test(l));
      if (suspect.length) {
        throw new Error(
          `[${lang}/${mod}/${s.slug}] '%%' used outside a format string:\n${suspect.join('\n')}`
        );
      }
    }

    const res = await runLocal(lang, s.solution);
    const diag = (res.compile || '').trim() || (res.stderr || '').trim();
    if (diag) {
      throw new Error(
        `[${lang}/${mod}/${s.slug}] solution failed:\n${diag.slice(0, 900)}\n---SOURCE---\n${s.solution}`
      );
    }
    const expected = norm(res.stdout);
    if (!expected) {
      throw new Error(`[${lang}/${mod}/${s.slug}] solution produced no output`);
    }

    const hints = s.hints
      ? s.hints
      : [s.hint, GENERIC_HINTS[lang]].filter(Boolean);

    const baseXp = XP_BY_TIER[tier] ?? 20;

    out.push({
      language_slug: lang,
      module_slug: mod,
      slug: s.slug,
      title: s.title,
      subtitle: s.subtitle || (isDrill ? 'Practice' : ''),
      kind: 'lesson',
      concept: s.concept || PRACTICE_INTRO[lang],
      example_code: s.example || '',
      example_note: s.note || '',
      task: s.task,
      starter_code: s.starter ?? scaffold(lang, s.given || ''),
      solution_code: s.solution,
      expected_output: expected,
      check_mode: s.check || 'exact',
      hints,
      quiz: null,
      xp: s.xp ?? (isDrill ? Math.max(8, baseXp - DRILL_DISCOUNT) : baseXp),
      sort_order: order++,
    });
  }

  return out;
}

export function fileFor(lang) {
  return FILE_OF[lang];
}
