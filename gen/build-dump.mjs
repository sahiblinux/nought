// Build lessons for specific languages and dump to JSON.
// Usage: node build-dump.mjs python c cpp java rust
// Reads existing curriculum-data.json and appends.
import fs from 'fs';
import { buildLessons } from './build.mjs';
import { SPINE } from './spine.mjs';

const langsToBuild = process.argv.slice(2);
if (!langsToBuild.length) { console.error('Usage: node build-dump.mjs python c cpp java rust'); process.exit(1); }

const MAP = {
  python: [
    ['py-output', './content/python-a.mjs', 'pyOutput'],
    ['py-values', './content/python-a.mjs', 'pyValues'],
    ['py-operators', './content/python-a.mjs', 'pyOperators'],
    ['py-conditionals', './content/python-b.mjs', 'pyConditionals'],
    ['py-loops', './content/python-b.mjs', 'pyLoops'],
    ['py-strings', './content/python-b.mjs', 'pyStrings'],
    ['py-lists', './content/python-c.mjs', 'pyLists'],
    ['py-dicts', './content/python-c.mjs', 'pyDicts'],
    ['py-functions', './content/python-c.mjs', 'pyFunctions'],
    ['py-comprehensions', './content/python-d.mjs', 'pyComprehensions'],
    ['py-oop', './content/python-d.mjs', 'pyOop'],
    ['py-advanced', './content/python-d.mjs', 'pyAdvanced'],
  ],
  c: [
    ['c-basics', './content/c-a.mjs', 'cBasics'],
    ['c-types', './content/c-a.mjs', 'cTypes'],
    ['c-operators', './content/c-b.mjs', 'cOperators'],
    ['c-conditionals', './content/c-b.mjs', 'cConditionals'],
    ['c-loops', './content/c-c.mjs', 'cLoops'],
    ['c-functions', './content/c-c.mjs', 'cFunctions'],
    ['c-arrays', './content/c-d.mjs', 'cArrays'],
    ['c-strings', './content/c-d.mjs', 'cStrings'],
    ['c-pointers', './content/c-e.mjs', 'cPointers'],
    ['c-structs', './content/c-e.mjs', 'cStructs'],
    ['c-memory', './content/c-e.mjs', 'cMemory'],
    ['c-advanced', './content/c-f.mjs', 'cAdvanced'],
  ],
  cpp: [
    ['cpp-basics', './content/cpp-a.mjs', 'cppBasics'],
    ['cpp-types', './content/cpp-a.mjs', 'cppTypes'],
    ['cpp-operators', './content/cpp-b.mjs', 'cppOperators'],
    ['cpp-flow', './content/cpp-b.mjs', 'cppFlow'],
    ['cpp-functions', './content/cpp-c.mjs', 'cppFunctions'],
    ['cpp-strings', './content/cpp-c.mjs', 'cppStrings'],
    ['cpp-vector', './content/cpp-d.mjs', 'cppVector'],
    ['cpp-containers', './content/cpp-d.mjs', 'cppContainers'],
    ['cpp-algorithms', './content/cpp-e.mjs', 'cppAlgorithms'],
    ['cpp-classes', './content/cpp-f.mjs', 'cppClasses'],
    ['cpp-templates', './content/cpp-g.mjs', 'cppTemplates'],
    ['cpp-advanced', './content/cpp-g.mjs', 'cppAdvanced'],
  ],
  java: [
    ['java-basics', './content/java-a.mjs', 'javaBasics'],
    ['java-types', './content/java-a.mjs', 'javaTypes'],
    ['java-operators', './content/java-b.mjs', 'javaOperators'],
    ['java-flow', './content/java-b.mjs', 'javaFlow'],
    ['java-methods', './content/java-c.mjs', 'javaMethods'],
    ['java-strings', './content/java-c.mjs', 'javaStrings'],
    ['java-arrays', './content/java-d.mjs', 'javaArrays'],
    ['java-collections', './content/java-d.mjs', 'javaCollections'],
    ['java-oop', './content/java-e.mjs', 'javaOop'],
    ['java-inheritance', './content/java-f.mjs', 'javaInheritance'],
    ['java-generics', './content/java-g.mjs', 'javaGenerics'],
    ['java-advanced', './content/java-h.mjs', 'javaAdvanced'],
  ],
  rust: [
    ['rust-basics', './content/rust-a.mjs', 'rustBasics'],
    ['rust-bindings', './content/rust-a.mjs', 'rustBindings'],
    ['rust-operators', './content/rust-b.mjs', 'rustOperators'],
    ['rust-flow', './content/rust-b.mjs', 'rustFlow'],
    ['rust-functions', './content/rust-c.mjs', 'rustFunctions'],
    ['rust-strings', './content/rust-c.mjs', 'rustStrings'],
    ['rust-vectors', './content/rust-d.mjs', 'rustVectors'],
    ['rust-ownership', './content/rust-e.mjs', 'rustOwnership'],
    ['rust-borrowing', './content/rust-e.mjs', 'rustOwnership'],
    ['rust-enums', './content/rust-e.mjs', 'rustEnums'],
    ['rust-structs', './content/rust-e.mjs', 'rustEnums'],
    ['rust-advanced', './content/rust-e.mjs', 'rustEnums'],
  ],
};

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

// Load existing data if file exists
const OUT_FILE = '../curriculum-data.json';
let existing = { modules: [], lessons: [] };
try { existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); } catch {}

const allModules = [...existing.modules];
const allLessons = [...existing.lessons];

for (const lang of langsToBuild) {
  const mods = MAP[lang];
  if (!mods) { console.error(`Unknown language: ${lang}`); continue; }
  
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

console.log(`\nTotal: ${allLessons.length} lessons, ${allModules.length} modules`);

const out = { modules: allModules, lessons: allLessons };
fs.writeFileSync(OUT_FILE, JSON.stringify(out));
const sizeMB = (Buffer.byteLength(JSON.stringify(out)) / 1024 / 1024).toFixed(1);
console.log(`Wrote curriculum-data.json (${sizeMB} MB)`);
