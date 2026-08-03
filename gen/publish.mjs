import fs from 'fs';
import path from 'path';
import { buildLessons } from './build.mjs';
import { SPINE } from './spine.mjs';

import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const { createClient } = await import(path.join(ROOT, 'node_modules/@supabase/supabase-js/dist/index.mjs'));

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// map: language -> module slug -> exported const name
const REGISTRY = {
  python: {
    files: ['./content/python-a.mjs', './content/python-b.mjs', './content/python-c.mjs', './content/python-d.mjs', './content/python-e.mjs'],
    map: {
      'py-output': 'pyOutput',
      'py-values': 'pyValues',
      'py-operators': 'pyOperators',
      'py-conditionals': 'pyConditionals',
      'py-loops': 'pyLoops',
      'py-strings': 'pyStrings',
      'py-lists': 'pyLists',
      'py-dicts': 'pyDicts',
      'py-functions': 'pyFunctions',
      'py-comprehensions': 'pyComprehensions',
      'py-oop': 'pyOop',
      'py-advanced': 'pyAdvanced',
    },
  },
  c: {
    files: ['./content/c-a.mjs', './content/c-b.mjs', './content/c-c.mjs', './content/c-d.mjs', './content/c-e.mjs', './content/c-f.mjs'],
    map: {
      'c-basics': 'cBasics',
      'c-types': 'cTypes',
      'c-operators': 'cOperators',
      'c-conditionals': 'cConditionals',
      'c-loops': 'cLoops',
      'c-functions': 'cFunctions',
      'c-arrays': 'cArrays',
      'c-strings': 'cStrings',
      'c-pointers': 'cPointers',
      'c-structs': 'cStructs',
      'c-memory': 'cMemory',
      'c-advanced': 'cAdvanced',
    },
  },
  cpp: {
    files: ['./content/cpp-a.mjs', './content/cpp-b.mjs', './content/cpp-c.mjs', './content/cpp-d.mjs', './content/cpp-e.mjs', './content/cpp-f.mjs'],
    map: {
      'cpp-basics': 'cppBasics',
      'cpp-types': 'cppTypes',
      'cpp-operators': 'cppOperators',
      'cpp-flow': 'cppFlow',
      'cpp-functions': 'cppFunctions',
      'cpp-strings': 'cppStrings',
      'cpp-vector': 'cppVector',
      'cpp-containers': 'cppContainers',
      'cpp-algorithms': 'cppAlgorithms',
      'cpp-classes': 'cppClasses',
      'cpp-templates': 'cppTemplates',
      'cpp-advanced': 'cppAdvanced',
    },
  },
  java: {
    files: ['./content/java-a.mjs', './content/java-b.mjs', './content/java-c.mjs', './content/java-d.mjs', './content/java-e.mjs', './content/java-f.mjs'],
    map: {
      'java-basics': 'javaBasics',
      'java-types': 'javaTypes',
      'java-operators': 'javaOperators',
      'java-flow': 'javaFlow',
      'java-methods': 'javaMethods',
      'java-strings': 'javaStrings',
      'java-arrays': 'javaArrays',
      'java-collections': 'javaCollections',
      'java-oop': 'javaOop',
      'java-inheritance': 'javaInheritance',
      'java-generics': 'javaGenerics',
      'java-advanced': 'javaAdvanced',
    },
  },
  rust: {
    files: ['./content/rust-a.mjs', './content/rust-b.mjs', './content/rust-c.mjs', './content/rust-d.mjs', './content/rust-e.mjs', './content/rust-f.mjs'],
    map: {
      'rust-basics': 'rustBasics',
      'rust-bindings': 'rustBindings',
      'rust-operators': 'rustOperators',
      'rust-flow': 'rustFlow',
      'rust-functions': 'rustFunctions',
      'rust-strings': 'rustStrings',
      'rust-vectors': 'rustVectors',
      'rust-ownership': 'rustOwnership',
      'rust-borrowing': 'rustBorrowing',
      'rust-enums': 'rustEnums',
      'rust-structs': 'rustStructs',
      'rust-advanced': 'rustAdvanced',
    },
  },
};

const targetLangs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const langs = targetLangs.length ? targetLangs : Object.keys(REGISTRY);
const dryRun = process.argv.includes('--dry');

for (const lang of langs) {
  const reg = REGISTRY[lang];
  if (!reg) { console.log('unknown language', lang); continue; }

  const specsByModule = {};
  for (const f of reg.files) {
    let mod;
    try {
      mod = await import(f);
    } catch (e) {
      console.log(`  [skip] ${f}: ${e.message.split('\n')[0]}`);
      continue;
    }
    for (const [name, value] of Object.entries(mod)) {
      if (Array.isArray(value)) specsByModule[name] = value;
    }
  }

  const spine = SPINE[lang];
  const allLessons = [];
  const modules = [];
  let missing = 0;

  for (let mi = 0; mi < spine.length; mi++) {
    const [slug, title, summary, tier] = spine[mi];
    const exportName = reg.map[slug];
    const specs = specsByModule[exportName];

    modules.push({
      language_slug: lang,
      slug,
      title,
      summary,
      tier,
      sort_order: mi + 1,
    });

    if (!specs) {
      console.log(`  [missing] ${lang}/${slug} (expects export ${exportName})`);
      missing++;
      continue;
    }

    const built = await buildLessons({
      lang,
      module: slug,
      tier,
      specs,
      startOrder: allLessons.length + 1,
    });
    allLessons.push(...built);
  }

  console.log(`${lang}: ${allLessons.length} lessons across ${spine.length - missing}/${spine.length} modules`);
  if (dryRun) continue;

  // wipe and rewrite this language
  await sb.from('lessons').delete().eq('language_slug', lang);
  await sb.from('modules').delete().eq('language_slug', lang);
  await sb.from('curriculum_modules').delete().eq('language_slug', lang);

  for (let i = 0; i < modules.length; i += 100) {
    const chunk = modules.slice(i, i + 100);
    const { error } = await sb.from('modules').insert(chunk.map(({ tier, ...m }) => m));
    if (error) { console.error('modules insert failed:', error.message); process.exit(1); }
    const { error: e2 } = await sb.from('curriculum_modules').insert(chunk);
    if (e2) { console.error('curriculum_modules insert failed:', e2.message); process.exit(1); }
  }

  for (let i = 0; i < allLessons.length; i += 60) {
    const chunk = allLessons.slice(i, i + 60);
    const { error } = await sb.from('lessons').insert(chunk);
    if (error) { console.error('lessons insert failed:', error.message); process.exit(1); }
    process.stdout.write('.');
  }
  console.log(` written`);
}

console.log('done');
