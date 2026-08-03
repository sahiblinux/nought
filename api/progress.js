import supabase from './db-client.js';
import { applyCors, requireIdentity, sendError } from './_auth.js';

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

/** Normalise output the same way the client grader does. */
const norm = (s) =>
  String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .trim();

async function evaluateAchievements(userKey, profile) {
  const [{ data: progress }, { data: lessons }, { data: all }, { data: earned }] =
    await Promise.all([
      supabase.from('progress').select('*').eq('user_key', userKey),
      supabase.from('lessons').select('id,language_slug,module_slug,kind'),
      supabase.from('achievements').select('*'),
      supabase.from('user_achievements').select('slug').eq('user_key', userKey),
    ]);

  const done = (progress || []).filter((p) => p.status === 'completed');
  const lessonById = new Map((lessons || []).map((l) => [l.id, l]));
  const langs = new Set(done.map((p) => p.language_slug));
  const have = new Set((earned || []).map((e) => e.slug));

  const perLang = {};
  for (const p of done) perLang[p.language_slug] = (perLang[p.language_slug] || 0) + 1;

  const moduleDone = (() => {
    const byModule = {};
    for (const l of lessons || []) {
      const k = `${l.language_slug}/${l.module_slug}`;
      byModule[k] = byModule[k] || { total: 0, done: 0 };
      byModule[k].total += 1;
    }
    for (const p of done) {
      const l = lessonById.get(p.lesson_id);
      if (!l) continue;
      const k = `${l.language_slug}/${l.module_slug}`;
      if (byModule[k]) byModule[k].done += 1;
    }
    return Object.values(byModule).some((m) => m.total > 0 && m.done === m.total);
  })();

  const flawless = done.some((p) => (p.attempts || 1) <= 1);
  const quizAce = done.some((p) => {
    const l = lessonById.get(p.lesson_id);
    return l && l.kind === 'quiz' && (p.attempts || 1) <= 1;
  });

  const tests = {
    first_steps: done.length >= 1,
    ten_down: done.length >= 10,
    twenty_five: done.length >= 25,
    polyglot: langs.size >= 3,
    pentaglot: langs.size >= 5,
    xp_500: (profile.xp || 0) >= 500,
    xp_1500: (profile.xp || 0) >= 1500,
    flawless,
    quiz_ace: quizAce,
    module_master: moduleDone,
    streak_3: (profile.streak || 0) >= 3,
    streak_7: (profile.streak || 0) >= 7,
    rustacean: (perLang.rust || 0) >= 3,
    close_to_metal: (perLang.c || 0) >= 3,
    snake_charmer: (perLang.python || 0) >= 3,
    jvm_pilot: (perLang.java || 0) >= 3,
    stl_scholar: (perLang.cpp || 0) >= 3,
  };

  const fresh = (all || []).filter((a) => tests[a.slug] && !have.has(a.slug));
  if (fresh.length === 0) return { fresh: [], bonusXp: 0 };

  await supabase
    .from('user_achievements')
    .insert(
      fresh.map((a) => ({ user_key: userKey, slug: a.slug, earned_at: new Date().toISOString() }))
    );
  const bonusXp = fresh.reduce((s, a) => s + (a.xp || 0), 0);
  return { fresh, bonusXp };
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  try {
    // Identity always comes from the verified token (or a namespaced guest
    // key). It is never read from the request body.
    const { userKey, displayName } = await requireIdentity(req);

    if (req.method === 'GET') {
      const q = supabase.from('progress').select('*').eq('user_key', userKey);
      if (req.query.language) q.eq('language_slug', String(req.query.language));
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const lessonId = Number(body.lesson_id) || 0;
    const code = String(body.code ?? '').slice(0, 8000);
    const output = String(body.output ?? '').slice(0, 4000);
    const heartLoss = !!body.heart_loss;

    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_key', userKey)
      .maybeSingle();

    if (!profile) {
      const { data: created, error } = await supabase
        .from('profiles')
        .insert({
          user_key: userKey,
          display_name: displayName || 'Learner',
          xp: 0,
          streak: 0,
          hearts: 5,
          lessons_done: 0,
          last_active: today(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      profile = created;
    }

    // Heart loss with no lesson attached (e.g. abandoning an attempt).
    if (heartLoss && !lessonId) {
      const { data: upd } = await supabase
        .from('profiles')
        .update({ hearts: Math.max(0, (profile.hearts ?? 5) - 1) })
        .eq('user_key', userKey)
        .select()
        .single();
      return res.status(200).json({ profile: upd || profile, progress: null, newAchievements: [] });
    }

    if (!lessonId) return res.status(400).json({ error: 'lesson_id required' });

    const { data: lesson } = await supabase
      .from('lessons')
      .select('id,xp,language_slug,kind,expected_output,check_mode')
      .eq('id', lessonId)
      .maybeSingle();
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    // XP is awarded on the server's own verdict, not on a client-supplied
    // "passed" flag. For code lessons the submitted output must match the
    // lesson's expected output; quizzes have no output to compare, so the
    // client's verdict is accepted for those only.
    let passed;
    if (lesson.kind === 'quiz') {
      passed = !!body.passed;
    } else {
      const expected = norm(lesson.expected_output);
      const actual = norm(output);
      passed =
        expected.length > 0 &&
        (lesson.check_mode === 'contains'
          ? expected
              .split('\n')
              .filter(Boolean)
              .every((line) => actual.includes(line.trim()))
          : actual === expected);
    }

    const { data: existing } = await supabase
      .from('progress')
      .select('*')
      .eq('user_key', userKey)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    const alreadyDone = existing?.status === 'completed';
    const attempts = (existing?.attempts || 0) + 1;
    const nowIso = new Date().toISOString();
    const status = passed || alreadyDone ? 'completed' : 'attempted';
    const xpEarned = passed && !alreadyDone ? lesson.xp || 20 : existing?.xp_earned || 0;

    const row = {
      user_key: userKey,
      lesson_id: lessonId,
      language_slug: lesson.language_slug,
      status,
      attempts,
      best_code: passed || !existing?.best_code ? code : existing.best_code,
      xp_earned: xpEarned,
      completed_at: status === 'completed' ? existing?.completed_at || nowIso : null,
      updated_at: nowIso,
    };

    let progressRow;
    if (existing) {
      const { data, error } = await supabase
        .from('progress')
        .update(row)
        .eq('id', existing.id)
        .eq('user_key', userKey)
        .select()
        .single();
      if (error) throw error;
      progressRow = data;
    } else {
      const { data, error } = await supabase.from('progress').insert(row).select().single();
      if (error) throw error;
      progressRow = data;
    }

    await supabase.from('submissions').insert({
      user_key: userKey,
      lesson_id: lessonId,
      language_slug: lesson.language_slug,
      code,
      output,
      passed,
      created_at: nowIso,
    });

    const newlyCompleted = passed && !alreadyDone;
    let updates;
    if (newlyCompleted) {
      let streak = profile.streak || 0;
      const last = profile.last_active;
      if (last === today()) streak = Math.max(1, streak);
      else if (last === yesterday()) streak = streak + 1;
      else streak = 1;
      updates = {
        xp: (profile.xp || 0) + (lesson.xp || 20),
        lessons_done: (profile.lessons_done || 0) + 1,
        hearts: 5,
        streak,
        last_active: today(),
      };
    } else if (!passed) {
      updates = { hearts: Math.max(0, (profile.hearts ?? 5) - 1), last_active: today() };
    } else {
      updates = { last_active: profile.last_active || today() };
    }

    const { data: updatedProfile } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_key', userKey)
      .select()
      .single();

    let profileOut = updatedProfile || profile;
    let fresh = [];
    if (newlyCompleted) {
      const result = await evaluateAchievements(userKey, profileOut);
      fresh = result.fresh;
      if (result.bonusXp > 0) {
        const { data: bumped } = await supabase
          .from('profiles')
          .update({ xp: (profileOut.xp || 0) + result.bonusXp })
          .eq('user_key', userKey)
          .select()
          .single();
        if (bumped) profileOut = bumped;
      }
    }

    return res.status(200).json({
      profile: profileOut,
      progress: progressRow,
      newAchievements: fresh,
      passed,
      xpGained: newlyCompleted ? lesson.xp || 20 : 0,
    });
  } catch (err) {
    return sendError(res, err, 'Could not save your progress.');
  }
}
