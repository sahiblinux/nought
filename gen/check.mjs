import { buildLessons } from './build.mjs';

const mods = await import(process.argv[2]);
let total = 0;
for (const [name, specs] of Object.entries(mods)) {
  if (!Array.isArray(specs)) continue;
  const lang = process.argv[3];
  try {
    const built = await buildLessons({ lang, module: name, tier: 'core', specs, startOrder: 1 });
    const lessons = built.filter(b => b.kind === 'lesson').length;
    const quizzes = built.filter(b => b.kind === 'quiz').length;
    total += built.length;
    console.log(`OK   ${name}: ${built.length} (${lessons} lessons, ${quizzes} quiz)`);
  } catch (e) {
    console.log(`FAIL ${name}`);
    console.log(e.message.slice(0, 1200));
  }
}
console.log('total', total);
