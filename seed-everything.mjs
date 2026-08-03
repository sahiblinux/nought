// ╔══════════════════════════════════════════════════════════════╗
// ║  seed-everything.mjs                                          ║
// ║  Run this AFTER running schema.sql in Supabase.               ║
// ║  It fills: languages, achievements, modules, lessons.         ║
// ║                                                               ║
// ║  Usage:                                                       ║
// ║    1. Edit .env with your Supabase keys                       ║
// ║    2. npm install                                             ║
// ║    3. node seed-everything.mjs                                ║
// ╚══════════════════════════════════════════════════════════════╝

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const { createClient } = await import(path.join(ROOT, 'node_modules/@supabase/supabase-js/dist/index.mjs'));

// ── Load .env ──────────────────────────────────────────────
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  console.error('❌ Missing Supabase keys in .env');
  console.error('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const sb = createClient(SUPA_URL, SUPA_KEY);
console.log('Connected to:', SUPA_URL);

// ── 1. LANGUAGES ───────────────────────────────────────────
console.log('\n📤 Inserting languages...');
const languages = [
  { slug: 'python', name: 'Python', tagline: 'Readable, forgiving, everywhere', blurb: "The gentlest place to start. No semicolons, no types to declare, no compiler to appease — indentation is the syntax. Ideal for grasping what a variable, a loop and a function actually are.", glyph: 'py', accent: '#4b5a6b', judge0_id: 100, filename: 'main.py', difficulty: 'Beginner', born: '1991', paradigm: 'Multi-paradigm, dynamically typed', sort_order: 1 },
  { slug: 'c', name: 'C', tagline: 'The machine, barely dressed up', blurb: "Small language, enormous consequences. You manage memory yourself and every abstraction is one you built. Learning C is how you find out what a pointer, a stack frame and a byte really are.", glyph: 'c', accent: '#a1573a', judge0_id: 103, filename: 'main.c', difficulty: 'Intermediate', born: '1972', paradigm: 'Procedural, statically typed', sort_order: 2 },
  { slug: 'cpp', name: 'C++', tagline: 'C, plus everything else', blurb: "All of C's control with classes, templates and a vast standard library on top. You get vectors and strings that manage themselves, and objects that clean up after their own scope.", glyph: 'c++', accent: '#52684a', judge0_id: 105, filename: 'main.cpp', difficulty: 'Intermediate', born: '1985', paradigm: 'Multi-paradigm, statically typed', sort_order: 3 },
  { slug: 'java', name: 'Java', tagline: 'Verbose on purpose, runs anywhere', blurb: "Everything lives inside a class and every type is spelled out. That strictness makes Java an excellent place to learn objects, interfaces and how large codebases stay organised.", glyph: 'jv', accent: '#8a6c20', judge0_id: 91, filename: 'Main.java', difficulty: 'Intermediate', born: '1995', paradigm: 'Object-oriented, statically typed', sort_order: 4 },
  { slug: 'rust', name: 'Rust', tagline: 'The compiler is your co-author', blurb: "C-level speed with no garbage collector and no data races, enforced by an ownership system the compiler checks. Frustrating for a week, then it changes how you think about memory forever.", glyph: 'rs', accent: '#7a4a35', judge0_id: 108, filename: 'main.rs', difficulty: 'Advanced', born: '2015', paradigm: 'Multi-paradigm, ownership-based', sort_order: 5 },
];

const { error: langErr } = await sb.from('languages').upsert(languages, { onConflict: 'slug' });
if (langErr) { console.error('languages error:', langErr.message); process.exit(1); }
console.log('   ✅ 5 languages inserted');

// ── 2. ACHIEVEMENTS ────────────────────────────────────────
console.log('\n📤 Inserting achievements...');
const achievements = [
  { slug: 'first_steps', title: 'First Steps', description: 'Cleared your very first lesson.', glyph: '01', xp: 15, sort_order: 1 },
  { slug: 'ten_down', title: 'Ten Down', description: 'Cleared 10 lessons in total.', glyph: '10', xp: 40, sort_order: 2 },
  { slug: 'twenty_five', title: 'Quarter Century', description: 'Cleared 25 lessons in total.', glyph: '25', xp: 90, sort_order: 3 },
  { slug: 'flawless', title: 'Flawless', description: 'Passed a lesson on the very first run.', glyph: '✓', xp: 25, sort_order: 4 },
  { slug: 'quiz_ace', title: 'Quiz Ace', description: 'Aced a checkpoint quiz first time.', glyph: '?', xp: 30, sort_order: 5 },
  { slug: 'module_master', title: 'Module Master', description: 'Finished every lesson in a module.', glyph: '■', xp: 50, sort_order: 6 },
  { slug: 'polyglot', title: 'Polyglot', description: 'Wrote working code in 3 languages.', glyph: '3×', xp: 60, sort_order: 7 },
  { slug: 'pentaglot', title: 'Pentaglot', description: 'Wrote working code in all 5 languages.', glyph: '5×', xp: 120, sort_order: 8 },
  { slug: 'streak_3', title: 'Three in a Row', description: 'Kept a 3-day learning streak.', glyph: '≍', xp: 30, sort_order: 9 },
  { slug: 'streak_7', title: 'Full Week', description: 'Kept a 7-day learning streak.', glyph: '≈', xp: 80, sort_order: 10 },
  { slug: 'xp_500', title: 'Five Hundred', description: 'Banked 500 XP.', glyph: '½', xp: 40, sort_order: 11 },
  { slug: 'xp_1500', title: 'Fifteen Hundred', description: 'Banked 1500 XP.', glyph: '↑', xp: 100, sort_order: 12 },
  { slug: 'snake_charmer', title: 'Snake Charmer', description: 'Cleared 3 Python lessons.', glyph: 'py', xp: 25, sort_order: 13 },
  { slug: 'close_to_metal', title: 'Close to the Metal', description: 'Cleared 3 C lessons.', glyph: 'c', xp: 25, sort_order: 14 },
  { slug: 'stl_scholar', title: 'STL Scholar', description: 'Cleared 3 C++ lessons.', glyph: 'c+', xp: 25, sort_order: 15 },
  { slug: 'jvm_pilot', title: 'JVM Pilot', description: 'Cleared 3 Java lessons.', glyph: 'jv', xp: 25, sort_order: 16 },
  { slug: 'rustacean', title: 'Rustacean', description: 'Cleared 3 Rust lessons.', glyph: 'rs', xp: 25, sort_order: 17 },
];

const { error: achErr } = await sb.from('achievements').upsert(achievements, { onConflict: 'slug' });
if (achErr) { console.error('achievements error:', achErr.message); process.exit(1); }
console.log('   ✅ 17 achievements inserted');

// ── 3. LESSONS + MODULES (via gen/seed.mjs) ────────────────
console.log('\n📤 Inserting modules and lessons...');
console.log('   (This uses gen/seed.mjs — takes 2-3 minutes)\n');

// Import and run the existing seed logic
try {
  const { buildLessons } = await import('./gen/build.mjs');
  const { SPINE } = await import('./gen/spine.mjs');

  const MAP = {
    python: [
      ['py-output', './gen/content/python-a.mjs', 'pyOutput'],
      ['py-values', './gen/content/python-a.mjs', 'pyValues'],
      ['py-operators', './gen/content/python-a.mjs', 'pyOperators'],
      ['py-conditionals', './gen/content/python-b.mjs', 'pyConditionals'],
      ['py-loops', './gen/content/python-b.mjs', 'pyLoops'],
      ['py-strings', './gen/content/python-b.mjs', 'pyStrings'],
      ['py-lists', './gen/content/python-c.mjs', 'pyLists'],
      ['py-dicts', './gen/content/python-c.mjs', 'pyDicts'],
      ['py-functions', './gen/content/python-c.mjs', 'pyFunctions'],
      ['py-comprehensions', './gen/content/python-d.mjs', 'pyComprehensions'],
      ['py-oop', './gen/content/python-d.mjs', 'pyOop'],
      ['py-advanced', './gen/content/python-d.mjs', 'pyAdvanced'],
    ],
    c: [
      ['c-basics', './gen/content/c-a.mjs', 'cBasics'],
      ['c-types', './gen/content/c-a.mjs', 'cTypes'],
      ['c-operators', './gen/content/c-b.mjs', 'cOperators'],
      ['c-conditionals', './gen/content/c-b.mjs', 'cConditionals'],
      ['c-loops', './gen/content/c-c.mjs', 'cLoops'],
      ['c-functions', './gen/content/c-c.mjs', 'cFunctions'],
      ['c-arrays', './gen/content/c-d.mjs', 'cArrays'],
      ['c-strings', './gen/content/c-d.mjs', 'cStrings'],
      ['c-pointers', './gen/content/c-e.mjs', 'cPointers'],
      ['c-structs', './gen/content/c-e.mjs', 'cStructs'],
    ],
    cpp: [
      ['cpp-basics', './gen/content/cpp-a.mjs', 'cppBasics'],
      ['cpp-types', './gen/content/cpp-a.mjs', 'cppTypes'],
      ['cpp-control', './gen/content/cpp-b.mjs', 'cppControl'],
      ['cpp-loops', './gen/content/cpp-b.mjs', 'cppLoops'],
      ['cpp-functions', './gen/content/cpp-c.mjs', 'cppFunctions'],
      ['cpp-references', './gen/content/cpp-c.mjs', 'cppReferences'],
      ['cpp-classes', './gen/content/cpp-d.mjs', 'cppClasses'],
      ['cpp-containers', './gen/content/cpp-d.mjs', 'cppContainers'],
      ['cpp-templates', './gen/content/cpp-e.mjs', 'cppTemplates'],
      ['cpp-stl', './gen/content/cpp-e.mjs', 'cppStl'],
    ],
    java: [
      ['java-basics', './gen/content/java-a.mjs', 'javaBasics'],
      ['java-types', './gen/content/java-a.mjs', 'javaTypes'],
      ['java-control', './gen/content/java-b.mjs', 'javaControl'],
      ['java-loops', './gen/content/java-b.mjs', 'javaLoops'],
      ['java-methods', './gen/content/java-c.mjs', 'javaMethods'],
      ['java-arrays', './gen/content/java-c.mjs', 'javaArrays'],
      ['java-classes', './gen/content/java-d.mjs', 'javaClasses'],
      ['java-collections', './gen/content/java-d.mjs', 'javaCollections'],
      ['java-interfaces', './gen/content/java-e.mjs', 'javaInterfaces'],
      ['java-exceptions', './gen/content/java-e.mjs', 'javaExceptions'],
    ],
    rust: [
      ['rust-basics', './gen/content/rust-a.mjs', 'rustBasics'],
      ['rust-types', './gen/content/rust-a.mjs', 'rustTypes'],
      ['rust-control', './gen/content/rust-b.mjs', 'rustControl'],
      ['rust-loops', './gen/content/rust-b.mjs', 'rustLoops'],
      ['rust-functions', './gen/content/rust-c.mjs', 'rustFunctions'],
      ['rust-ownership', './gen/content/rust-c.mjs', 'rustOwnership'],
      ['rust-structs', './gen/content/rust-d.mjs', 'rustStructs'],
      ['rust-enums', './gen/content/rust-d.mjs', 'rustEnums'],
      ['rust-collections', './gen/content/rust-e.mjs', 'rustCollections'],
      ['rust-traits', './gen/content/rust-e.mjs', 'rustTraits'],
    ],
  };

  const RUST_SPLIT = {};

  async function specsFor(file, exportName) {
    const mod = await import(file);
    return mod[exportName] || [];
  }

  const allModules = [];
  const allLessons = [];

  for (const [lang, mods] of Object.entries(MAP)) {
    let order = 1;
    const spineFor = Object.fromEntries(SPINE[lang].map((m) => [m[0], m]));

    for (let mi = 0; mi < mods.length; mi++) {
      const [slug, file, exportName] = mods[mi];
      let specs = await specsFor(file, exportName);

      if (lang === 'rust' && RUST_SPLIT[slug]) {
        const [from, to] = RUST_SPLIT[slug];
        specs = specs.slice(from, to);
      }

      const spineEntry = spineFor[slug];
      if (!spineEntry) { console.warn(`  ⚠ no spine for ${lang}/${slug}, skipping`); continue; }
      const [, title, summary, tier] = spineEntry;
      allModules.push({ language_slug: lang, slug, title, summary, tier, sort_order: mi + 1 });

      const built = await buildLessons({ lang, module: slug, tier, specs, startOrder: order });
      order += built.length;
      allLessons.push(...built);
      process.stdout.write(`  ${lang}/${slug}: ${built.length} lessons\n`);
    }
  }

  console.log(`\n  Total: ${allLessons.length} lessons, ${allModules.length} modules`);

  // Clear existing (only lesson/module tables — NOT user data)
  console.log('\n  Clearing old lessons/modules...');
  await sb.from('lessons').delete().neq('id', -1);
  await sb.from('modules').delete().neq('id', -1);
  await sb.from('curriculum_modules').delete().neq('id', -1);

  // Insert modules
  console.log('  Inserting modules...');
  for (let i = 0; i < allModules.length; i += 200) {
    const { error } = await sb.from('curriculum_modules').insert(allModules.slice(i, i + 200));
    if (error) throw error;
  }
  for (let i = 0; i < allModules.length; i += 200) {
    const { error } = await sb.from('modules').insert(
      allModules.slice(i, i + 200).map(({ tier, ...rest }) => rest)
    );
    if (error) throw error;
  }

  // Insert lessons
  console.log('  Inserting lessons...');
  for (let i = 0; i < allLessons.length; i += 100) {
    const { error } = await sb.from('lessons').insert(allLessons.slice(i, i + 100));
    if (error) {
      console.error(`\n  ❌ Insert failed at lesson ${i}:`, error.message);
      throw error;
    }
    process.stdout.write('.');
  }

  console.log('\n\n╔═══════════════════════════════════════════════╗');
  console.log('║  ✅ DATABASE SEEDED SUCCESSFULLY!              ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log(`   Languages:    5`);
  console.log(`   Achievements: 17`);
  console.log(`   Modules:      ${allModules.length}`);
  console.log(`   Lessons:      ${allLessons.length}`);
  console.log('\n   Your app is ready. Deploy it!');

} catch (err) {
  console.error('\n❌ Seed failed:', err.message);
  console.error('   Languages and achievements were inserted successfully.');
  console.error('   The lesson content failed. Check that gen/content/ files exist.');
  process.exit(1);
}
