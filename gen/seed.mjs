import fs from 'fs';
import path from 'path';
import { buildLessons } from './gen/build.mjs';
import { SPINE } from './gen/spine.mjs';

const ROOT = process.cwd();
const { createClient } = await import(path.join(ROOT, 'node_modules/@supabase/supabase-js/dist/index.mjs'));

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// module slug -> exported spec array name
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
    ['c-memory', './gen/content/c-e.mjs', 'cMemory'],
    ['c-advanced', './gen/content/c-f.mjs', 'cAdvanced'],
  ],
  cpp: [
    ['cpp-basics', './gen/content/cpp-a.mjs', 'cppBasics'],
    ['cpp-types', './gen/content/cpp-a.mjs', 'cppTypes'],
    ['cpp-operators', './gen/content/cpp-b.mjs', 'cppOperators'],
    ['cpp-flow', './gen/content/cpp-b.mjs', 'cppFlow'],
    ['cpp-functions', './gen/content/cpp-c.mjs', 'cppFunctions'],
    ['cpp-strings', './gen/content/cpp-c.mjs', 'cppStrings'],
    ['cpp-vector', './gen/content/cpp-d.mjs', 'cppVector'],
    ['cpp-containers', './gen/content/cpp-d.mjs', 'cppContainers'],
    ['cpp-algorithms', './gen/content/cpp-e.mjs', 'cppAlgorithms'],
    ['cpp-classes', './gen/content/cpp-f.mjs', 'cppClasses'],
    ['cpp-templates', './gen/content/cpp-g.mjs', 'cppTemplates'],
    ['cpp-advanced', './gen/content/cpp-g.mjs', 'cppAdvanced'],
  ],
  java: [
    ['java-basics', './gen/content/java-a.mjs', 'javaBasics'],
    ['java-types', './gen/content/java-a.mjs', 'javaTypes'],
    ['java-operators', './gen/content/java-b.mjs', 'javaOperators'],
    ['java-flow', './gen/content/java-b.mjs', 'javaFlow'],
    ['java-methods', './gen/content/java-c.mjs', 'javaMethods'],
    ['java-strings', './gen/content/java-c.mjs', 'javaStrings'],
    ['java-arrays', './gen/content/java-d.mjs', 'javaArrays'],
    ['java-collections', './gen/content/java-d.mjs', 'javaCollections'],
    ['java-oop', './gen/content/java-e.mjs', 'javaOop'],
    ['java-inheritance', './gen/content/java-f.mjs', 'javaInheritance'],
    ['java-generics', './gen/content/java-g.mjs', 'javaGenerics'],
    ['java-advanced', './gen/content/java-h.mjs', 'javaAdvanced'],
  ],
  rust: [
    ['rust-basics', './gen/content/rust-a.mjs', 'rustBasics'],
    ['rust-bindings', './gen/content/rust-a.mjs', 'rustBindings'],
    ['rust-operators', './gen/content/rust-b.mjs', 'rustOperators'],
    ['rust-flow', './gen/content/rust-b.mjs', 'rustFlow'],
    ['rust-functions', './gen/content/rust-c.mjs', 'rustFunctions'],
    ['rust-strings', './gen/content/rust-c.mjs', 'rustStrings'],
    ['rust-vectors', './gen/content/rust-d.mjs', 'rustVectors'],
    ['rust-ownership', './gen/content/rust-e.mjs', 'rustOwnership'],
    ['rust-borrowing', './gen/content/rust-e.mjs', 'rustOwnership'],
    ['rust-enums', './gen/content/rust-e.mjs', 'rustEnums'],
    ['rust-structs', './gen/content/rust-e.mjs', 'rustEnums'],
    ['rust-advanced', './gen/content/rust-e.mjs', 'rustEnums'],
  ],
};

// Rust: ownership file provides 2 modules and enums file 3 -> split them
const RUST_SPLIT = {
  'rust-ownership': [0, 11],
  'rust-borrowing': [11, 21],
  'rust-enums': [0, 12],
  'rust-structs': [12, 24],
  'rust-advanced': [24, 35],
};

const cache = new Map();
async function specsFor(file, name) {
  if (!cache.has(file)) cache.set(file, await import(file));
  const mod = cache.get(file);
  if (!mod[name]) throw new Error(`missing export ${name} in ${file}`);
  return mod[name];
}

const TIER_OF = {};
for (const [lang, mods] of Object.entries(SPINE)) {
  for (const [slug, , , tier] of mods) TIER_OF[`${lang}/${slug}`] = tier;
}

const allLessons = [];
const allModules = [];

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

    const [, title, summary, tier] = spineFor[slug];
    allModules.push({
      language_slug: lang,
      slug,
      title,
      summary,
      tier,
      sort_order: mi + 1,
    });

    const built = await buildLessons({ lang, module: slug, tier, specs, startOrder: order });
    order += built.length;
    allLessons.push(...built);
    process.stdout.write(`${lang}/${slug}: ${built.length}\n`);
  }
}

console.log('total lessons', allLessons.length);

// Wipe and reload
for (const table of ['progress', 'submissions', 'user_achievements', 'profiles']) {
  await sb.from(table).delete().neq('id', -1);
}
await sb.from('lessons').delete().neq('id', -1);
await sb.from('modules').delete().neq('id', -1);
await sb.from('curriculum_modules').delete().neq('id', -1);

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

for (let i = 0; i < allLessons.length; i += 100) {
  const chunk = allLessons.slice(i, i + 100);
  const { error } = await sb.from('lessons').insert(chunk);
  if (error) {
    console.error('insert failed at', i, error.message);
    throw error;
  }
  process.stdout.write('.');
}
console.log('\nseeded', allLessons.length, 'lessons and', allModules.length, 'modules');
