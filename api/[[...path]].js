import supabase from '../lib/db-client.js';
import { applyCors, resolveIdentity, requireIdentity, sendError, isGuestKey } from '../lib/_auth.js';
import { sendEmail, otpEmail, tempPasswordEmail } from '../lib/_email.js';
import { checkRunLimit, clientIp } from '../lib/_ratelimit.js';
import crypto from 'crypto';

/* ─── helpers ─── */
const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const norm = (s) =>
  String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .trim();

/* ─── route handlers ─── */

async function handleLanguages(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { data: languages, error } = await supabase
      .from('languages').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    const out = await Promise.all((languages || []).map(async (l) => {
      const [{ count: lessonCount }, { count: moduleCount }] = await Promise.all([
        supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('language_slug', l.slug),
        supabase.from('modules').select('id', { count: 'exact', head: true }).eq('language_slug', l.slug),
      ]);
      return { ...l, lesson_count: lessonCount || 0, module_count: moduleCount || 0 };
    }));
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(out);
  } catch (err) { return sendError(res, err, 'Could not load the languages.'); }
}

async function handleCurriculum(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const slug = String(req.query.language || '');
    if (!slug) return res.status(400).json({ error: 'language query param required' });
    const { data: language, error: lErr } = await supabase.from('languages').select('*').eq('slug', slug).maybeSingle();
    if (lErr) throw lErr;
    if (!language) return res.status(404).json({ error: 'Language not found' });
    const { data: modules, error: mErr } = await supabase.from('modules').select('*').eq('language_slug', slug).order('sort_order', { ascending: true });
    if (mErr) throw mErr;
    const { data: lessons, error: sErr } = await supabase.from('lessons').select('id,language_slug,module_slug,slug,title,subtitle,kind,xp,sort_order').eq('language_slug', slug).order('sort_order', { ascending: true }).limit(2000);
    if (sErr) throw sErr;
    return res.status(200).json({ language, modules: modules || [], lessons: lessons || [] });
  } catch (err) { console.error('curriculum error:', err); return res.status(500).json({ error: err.message }); }
}

async function handleLesson(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const language = String(req.query.language || '');
    const slug = String(req.query.slug || '');
    if (!language || !slug) return res.status(400).json({ error: 'language and slug required' });
    const { data: lesson, error } = await supabase.from('lessons').select('*').eq('language_slug', language).eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    const [{ data: order }, { data: lang }, { data: mod }] = await Promise.all([
      supabase.from('lessons').select('id,slug,title,kind,sort_order,module_slug,xp').eq('language_slug', language).order('sort_order', { ascending: true }).limit(2000),
      supabase.from('languages').select('*').eq('slug', language).maybeSingle(),
      supabase.from('modules').select('*').eq('language_slug', language).eq('slug', lesson.module_slug).maybeSingle(),
    ]);
    const flat = order || [];
    const idx = flat.findIndex((l) => l.id === lesson.id);
    return res.status(200).json({ lesson, language: lang || null, module: mod || null, flat, index: idx, prev: idx > 0 ? flat[idx - 1] : null, next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null });
  } catch (err) { console.error('lesson error:', err); return res.status(500).json({ error: err.message }); }
}

/* ─── run ─── */
const JUDGE0_URL = (process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/+$/, '');
const JUDGE0_KEY = process.env.JUDGE0_KEY || '';
const RAPIDAPI_HOST = process.env.JUDGE0_RAPIDAPI_HOST || '';
const LANGS = { python: { id: 100, file: 'main.py' }, c: { id: 103, file: 'main.c' }, cpp: { id: 105, file: 'main.cpp' }, java: { id: 91, file: 'Main.java' }, rust: { id: 108, file: 'main.rs' } };
const MAX_CODE_BYTES = 40_000;
const MAX_STDIN_BYTES = 8_000;
const b64 = (s) => Buffer.from(s ?? '', 'utf8').toString('base64');
const unb64 = (s) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');

function judgeHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (JUDGE0_KEY && RAPIDAPI_HOST) { h['X-RapidAPI-Key'] = JUDGE0_KEY; h['X-RapidAPI-Host'] = RAPIDAPI_HOST; }
  else if (JUDGE0_KEY) { h['X-Auth-Token'] = JUDGE0_KEY; }
  return h;
}

async function handleRun(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const identity = await resolveIdentity(req);
    const ip = clientIp(req);
    const limitKey = identity?.userKey || `ip_${ip}`;
    const gate = await checkRunLimit(limitKey, ip);
    if (!gate.ok) { res.setHeader('Retry-After', String(gate.retryAfter || 30)); return res.status(gate.status).json({ error: gate.message, rateLimited: true }); }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const language = String(body.language || '');
    const code = String(body.code ?? '');
    const stdin = String(body.stdin ?? '');
    const spec = LANGS[language];
    if (!spec) return res.status(400).json({ error: `Unsupported language: ${language || '(none)'}` });
    if (!code.trim()) return res.status(400).json({ error: 'There is no code to run yet.' });
    if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) return res.status(413).json({ error: 'That program is too large to run here.' });
    const payload = { language_id: spec.id, source_code: b64(code), stdin: b64(stdin.slice(0, MAX_STDIN_BYTES)), cpu_time_limit: 8, wall_time_limit: 12, memory_limit: 256000 };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    let response;
    try {
      response = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`, { method: 'POST', headers: judgeHeaders(), body: JSON.stringify(payload), signal: controller.signal });
    } catch (e) {
      clearTimeout(timer);
      const msg = e.name === 'AbortError' ? 'The runner took too long to respond. Try again.' : 'Could not reach the code runner. It may be busy — try again in a moment.';
      return res.status(503).json({ error: msg, runnerDown: true });
    }
    clearTimeout(timer);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 429) return res.status(503).json({ error: 'The shared code runner is rate limiting right now. Please try again shortly.', runnerDown: true });
      console.error('judge0 error', response.status, text.slice(0, 300));
      return res.status(503).json({ error: 'The code runner returned an error. Please try again.', runnerDown: true });
    }
    const dRaw = await response.text();
    let d;
    try { d = JSON.parse(dRaw); } catch { return res.status(503).json({ error: 'The code runner sent an unreadable reply.', runnerDown: true }); }
    return res.status(200).json({ statusId: d.status?.id ?? 0, status: d.status?.description || 'Unknown', stdout: unb64(d.stdout), stderr: unb64(d.stderr), compileOutput: unb64(d.compile_output), message: d.message || '', time: d.time || null, memory: d.memory || null });
  } catch (err) { return sendError(res, err, 'Could not run your code.'); }
}

/* ─── progress ─── */
async function evaluateAchievements(userKey, profile) {
  const [{ data: progress }, { data: lessons }, { data: all }, { data: earned }] = await Promise.all([
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
    for (const l of lessons || []) { const k = `${l.language_slug}/${l.module_slug}`; byModule[k] = byModule[k] || { total: 0, done: 0 }; byModule[k].total += 1; }
    for (const p of done) { const l = lessonById.get(p.lesson_id); if (!l) continue; const k = `${l.language_slug}/${l.module_slug}`; if (byModule[k]) byModule[k].done += 1; }
    return Object.values(byModule).some((m) => m.total > 0 && m.done === m.total);
  })();
  const flawless = done.some((p) => (p.attempts || 1) <= 1);
  const quizAce = done.some((p) => { const l = lessonById.get(p.lesson_id); return l && l.kind === 'quiz' && (p.attempts || 1) <= 1; });
  const tests = {
    first_steps: done.length >= 1, ten_down: done.length >= 10, twenty_five: done.length >= 25,
    polyglot: langs.size >= 3, pentaglot: langs.size >= 5, xp_500: (profile.xp || 0) >= 500,
    xp_1500: (profile.xp || 0) >= 1500, flawless, quiz_ace: quizAce, module_master: moduleDone,
    streak_3: (profile.streak || 0) >= 3, streak_7: (profile.streak || 0) >= 7,
    rustacean: (perLang.rust || 0) >= 3, close_to_metal: (perLang.c || 0) >= 3,
    snake_charmer: (perLang.python || 0) >= 3, jvm_pilot: (perLang.java || 0) >= 3, stl_scholar: (perLang.cpp || 0) >= 3,
  };
  const fresh = (all || []).filter((a) => tests[a.slug] && !have.has(a.slug));
  if (fresh.length === 0) return { fresh: [], bonusXp: 0 };
  await supabase.from('user_achievements').insert(fresh.map((a) => ({ user_key: userKey, slug: a.slug, earned_at: new Date().toISOString() })));
  const bonusXp = fresh.reduce((s, a) => s + (a.xp || 0), 0);
  return { fresh, bonusXp };
}

async function handleProgress(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  try {
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
    let { data: profile } = await supabase.from('profiles').select('*').eq('user_key', userKey).maybeSingle();
    if (!profile) {
      const { data: created, error } = await supabase.from('profiles').insert({ user_key: userKey, display_name: displayName || 'Learner', xp: 0, streak: 0, hearts: 5, lessons_done: 0, last_active: today(), created_at: new Date().toISOString() }).select().single();
      if (error) throw error; profile = created;
    }
    if (heartLoss && !lessonId) {
      const { data: upd } = await supabase.from('profiles').update({ hearts: Math.max(0, (profile.hearts ?? 5) - 1) }).eq('user_key', userKey).select().single();
      return res.status(200).json({ profile: upd || profile, progress: null, newAchievements: [] });
    }
    if (!lessonId) return res.status(400).json({ error: 'lesson_id required' });
    const { data: lesson } = await supabase.from('lessons').select('id,xp,language_slug,kind,expected_output,check_mode').eq('id', lessonId).maybeSingle();
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    let passed;
    if (lesson.kind === 'quiz') { passed = !!body.passed; } else {
      const expected = norm(lesson.expected_output);
      const actual = norm(output);
      passed = expected.length > 0 && (lesson.check_mode === 'contains' ? expected.split('\n').filter(Boolean).every((line) => actual.includes(line.trim())) : actual === expected);
    }
    const { data: existing } = await supabase.from('progress').select('*').eq('user_key', userKey).eq('lesson_id', lessonId).maybeSingle();
    const alreadyDone = existing?.status === 'completed';
    const attempts = (existing?.attempts || 0) + 1;
    const nowIso = new Date().toISOString();
    const status = passed || alreadyDone ? 'completed' : 'attempted';
    const xpEarned = passed && !alreadyDone ? lesson.xp || 20 : existing?.xp_earned || 0;
    const row = { user_key: userKey, lesson_id: lessonId, language_slug: lesson.language_slug, status, attempts, best_code: passed || !existing?.best_code ? code : existing.best_code, xp_earned: xpEarned, completed_at: status === 'completed' ? existing?.completed_at || nowIso : null, updated_at: nowIso };
    let progressRow;
    if (existing) { const { data, error } = await supabase.from('progress').update(row).eq('id', existing.id).eq('user_key', userKey).select().single(); if (error) throw error; progressRow = data; }
    else { const { data, error } = await supabase.from('progress').insert(row).select().single(); if (error) throw error; progressRow = data; }
    await supabase.from('submissions').insert({ user_key: userKey, lesson_id: lessonId, language_slug: lesson.language_slug, code, output, passed, created_at: nowIso });
    const newlyCompleted = passed && !alreadyDone;
    let updates;
    if (newlyCompleted) {
      let streak = profile.streak || 0;
      const last = profile.last_active;
      if (last === today()) streak = Math.max(1, streak); else if (last === yesterday()) streak = streak + 1; else streak = 1;
      updates = { xp: (profile.xp || 0) + (lesson.xp || 20), lessons_done: (profile.lessons_done || 0) + 1, hearts: 5, streak, last_active: today() };
    } else if (!passed) { updates = { hearts: Math.max(0, (profile.hearts ?? 5) - 1), last_active: today() }; }
    else { updates = { last_active: profile.last_active || today() }; }
    const { data: updatedProfile } = await supabase.from('profiles').update(updates).eq('user_key', userKey).select().single();
    let profileOut = updatedProfile || profile;
    let fresh = [];
    if (newlyCompleted) {
      const result = await evaluateAchievements(userKey, profileOut);
      fresh = result.fresh;
      if (result.bonusXp > 0) { const { data: bumped } = await supabase.from('profiles').update({ xp: (profileOut.xp || 0) + result.bonusXp }).eq('user_key', userKey).select().single(); if (bumped) profileOut = bumped; }
    }
    return res.status(200).json({ profile: profileOut, progress: progressRow, newAchievements: fresh, passed, xpGained: newlyCompleted ? lesson.xp || 20 : 0 });
  } catch (err) { return sendError(res, err, 'Could not save your progress.'); }
}

/* ─── me ─── */
async function ensureProfile({ userKey, displayName, email }) {
  const { data: existing, error } = await supabase.from('profiles').select('*').eq('user_key', userKey).maybeSingle();
  if (error) throw error;
  if (existing) {
    const wants = {};
    if (displayName && displayName !== existing.display_name) wants.display_name = displayName;
    if (email && email !== existing.email) wants.email = email;
    if (!Object.keys(wants).length) return existing;
    const { data: upd } = await supabase.from('profiles').update(wants).eq('user_key', userKey).select().single();
    return upd || existing;
  }
  const { data: created, error: cErr } = await supabase.from('profiles').insert({ user_key: userKey, display_name: displayName || 'Learner', email: email || null, xp: 0, streak: 0, hearts: 5, lessons_done: 0, last_active: today(), created_at: new Date().toISOString() }).select().single();
  if (cErr) throw cErr;
  return created;
}

async function handleMe(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const identity = await requireIdentity(req);
    const { userKey, isGuest } = identity;
    let profile = await ensureProfile(identity);
    const migrateFrom = String(req.query.migrate_from || '');
    if (!isGuest && isGuestKey(migrateFrom) && migrateFrom !== userKey && (profile.xp || 0) === 0) {
      const { data: mine } = await supabase.from('progress').select('id').eq('user_key', userKey).limit(1);
      if (!mine || mine.length === 0) {
        const { data: old } = await supabase.from('profiles').select('*').eq('user_key', migrateFrom).maybeSingle();
        await supabase.from('progress').update({ user_key: userKey }).eq('user_key', migrateFrom);
        await supabase.from('submissions').update({ user_key: userKey }).eq('user_key', migrateFrom);
        await supabase.from('user_achievements').update({ user_key: userKey }).eq('user_key', migrateFrom);
        if (old) {
          const { data: upd } = await supabase.from('profiles').update({ xp: old.xp || 0, streak: old.streak || 0, hearts: old.hearts ?? 5, lessons_done: old.lessons_done || 0, last_active: old.last_active || today() }).eq('user_key', userKey).select().single();
          if (upd) profile = upd;
          await supabase.from('profiles').delete().eq('user_key', migrateFrom);
        }
      }
    }
    const [{ data: progress }, { data: achievements }, { data: earned }] = await Promise.all([
      supabase.from('progress').select('*').eq('user_key', userKey),
      supabase.from('achievements').select('*').order('sort_order', { ascending: true }),
      supabase.from('user_achievements').select('*').eq('user_key', userKey),
    ]);
    const earnedMap = new Map((earned || []).map((e) => [e.slug, e.earned_at]));
    return res.status(200).json({ profile, isGuest, progress: progress || [], achievements: (achievements || []).map((a) => ({ ...a, earned: earnedMap.has(a.slug), earned_at: earnedMap.get(a.slug) || null })) });
  } catch (err) { return sendError(res, err, 'Could not load your progress.'); }
}

/* ─── submissions ─── */
async function handleSubmissions(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { userKey } = await requireIdentity(req);
    const { data, error } = await supabase.from('submissions').select('id,lesson_id,language_slug,passed,created_at').eq('user_key', userKey).order('created_at', { ascending: false }).limit(40);
    if (error) throw error;
    const ids = [...new Set((data || []).map((d) => d.lesson_id))];
    let titles = {};
    if (ids.length) { const { data: lessons } = await supabase.from('lessons').select('id,title,slug,language_slug').in('id', ids); titles = Object.fromEntries((lessons || []).map((l) => [l.id, l])); }
    return res.status(200).json((data || []).map((s) => ({ ...s, lesson_title: titles[s.lesson_id]?.title || 'Lesson', lesson_slug: titles[s.lesson_id]?.slug || '' })));
  } catch (err) { return sendError(res, err, 'Could not load your recent runs.'); }
}

/* ─── leaderboard ─── */
const opaque = (key) => crypto.createHash('sha256').update(`nought:${key}`).digest('hex').slice(0, 12);

async function handleLeaderboard(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    let me = null;
    try { const id = await resolveIdentity(req); me = id?.userKey || null; } catch { me = null; }
    const { data, error } = await supabase.from('profiles').select('user_key,display_name,xp,streak,lessons_done').gt('xp', 0).order('xp', { ascending: false }).limit(25);
    if (error) throw error;
    return res.status(200).json((data || []).map((r) => ({ id: opaque(r.user_key), display_name: r.display_name || 'Learner', xp: r.xp || 0, streak: r.streak || 0, lessons_done: r.lessons_done || 0, is_me: !!me && r.user_key === me })));
  } catch (err) { return sendError(res, err, 'Could not load the leaderboard.'); }
}

/* ─── stats ─── */
async function handleStats(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const [learners, lessons, languages, completions, runs] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('lessons').select('id', { count: 'exact', head: true }),
      supabase.from('languages').select('id', { count: 'exact', head: true }),
      supabase.from('progress').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }),
    ]);
    return res.status(200).json({ learners: learners.count || 0, lessons: lessons.count || 0, languages: languages.count || 0, completions: completions.count || 0, runs: runs.count || 0 });
  } catch (err) { console.error('stats error:', err); return res.status(500).json({ error: err.message }); }
}

/* ─── auth routes ─── */
async function handleAuthLogin(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    const { data: account, error: accErr } = await supabase.from('accounts').select('email, email_verified, user_key').eq('username', username).maybeSingle();
    if (accErr) throw accErr;
    if (!account) return res.status(401).json({ error: 'No account found with that username.' });
    if (!account.email_verified) return res.status(403).json({ error: 'Please verify your email first. Check your inbox for the code.', needs_verification: true, email: account.email });
    const { data, error } = await supabase.auth.signInWithPassword({ email: account.email, password });
    if (error) return res.status(401).json({ error: 'Incorrect password.' });
    return res.status(200).json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, user: { id: data.user.id, email: data.user.email } });
  } catch (err) { return sendError(res, err, 'Could not sign you in.'); }
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

async function handleAuthSignup(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Username must be 3–20 letters, numbers, or underscores.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const { data: existingUser } = await supabase.from('accounts').select('id').eq('username', username).maybeSingle();
    if (existingUser) return res.status(409).json({ error: 'That username is taken.' });
    const { data: existingEmail } = await supabase.from('accounts').select('id').eq('email', email).maybeSingle();
    if (existingEmail) return res.status(409).json({ error: 'An account with that email already exists.' });
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { username } });
    if (authErr) { if (authErr.message.includes('already')) return res.status(409).json({ error: 'An account with that email already exists.' }); throw authErr; }
    const userKey = authData.user.id;
    const { error: accErr } = await supabase.from('accounts').insert({ username, email, user_key: userKey, email_verified: false });
    if (accErr) throw accErr;
    await supabase.from('profiles').insert({ user_key: userKey, display_name: username, email, xp: 0, streak: 0, hearts: 5, lessons_done: 0, last_active: new Date().toISOString().slice(0, 10), created_at: new Date().toISOString() });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('otps').insert({ email, code, purpose: 'signup', expires_at: expiresAt, used: false });
    const emailResult = await sendEmail({ to: email, ...otpEmail(code) });
    return res.status(201).json({ ok: true, email, dev_otp: emailResult.dev ? code : undefined });
  } catch (err) { return sendError(res, err, 'Could not create your account.'); }
}

async function handleAuthVerifyOtp(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' });
    const { data: otp, error: otpErr } = await supabase.from('otps').select('id,expires_at,used').eq('email', email).eq('code', code).eq('purpose', 'signup').eq('used', false).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (otpErr) throw otpErr;
    if (!otp) return res.status(400).json({ error: 'Invalid verification code.' });
    if (new Date(otp.expires_at) < new Date()) return res.status(400).json({ error: 'That code has expired. Request a new one.' });
    await supabase.from('otps').update({ used: true }).eq('id', otp.id);
    const { data: account, error: accErr } = await supabase.from('accounts').update({ email_verified: true }).eq('email', email).select('user_key').single();
    if (accErr) throw accErr;
    if (account?.user_key) await supabase.auth.admin.updateUserById(account.user_key, { email_confirm: true });
    return res.status(200).json({ verified: true });
  } catch (err) { return sendError(res, err, 'Could not verify your code.'); }
}

async function handleAuthForgotPassword(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();
    if (!username || !email) return res.status(400).json({ error: 'Username and email are required.' });
    const { data: account, error: accErr } = await supabase.from('accounts').select('user_key, email, username').eq('username', username).eq('email', email).maybeSingle();
    if (accErr) throw accErr;
    if (!account) return res.status(404).json({ error: 'No account matches that username and email.' });
    const tempPassword = crypto.randomBytes(6).toString('base64url').slice(0, 10);
    const { error: updErr } = await supabase.auth.admin.updateUserById(account.user_key, { password: tempPassword });
    if (updErr) throw updErr;
    const emailResult = await sendEmail({ to: account.email, ...tempPasswordEmail(tempPassword) });
    return res.status(200).json({ ok: true, dev_password: emailResult.dev ? tempPassword : undefined });
  } catch (err) { return sendError(res, err, 'Could not reset your password.'); }
}

async function handleAuthResendOtp(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const { data: recent } = await supabase.from('otps').select('created_at').eq('email', email).eq('purpose', 'signup').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (recent && new Date(recent.created_at) > new Date(Date.now() - 30_000)) return res.status(429).json({ error: 'Please wait a moment before requesting another code.' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('otps').insert({ email, code, purpose: 'signup', expires_at: expiresAt, used: false });
    const emailResult = await sendEmail({ to: email, ...otpEmail(code) });
    return res.status(200).json({ ok: true, dev_otp: emailResult.dev ? code : undefined });
  } catch (err) { return sendError(res, err, 'Could not resend the code.'); }
}

async function handleAuthChangePassword(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { userKey } = await requireIdentity(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const currentPassword = String(body.current_password || '');
    const newPassword = String(body.new_password || '');
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords are required.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    if (currentPassword === newPassword) return res.status(400).json({ error: 'New password must be different from the current one.' });
    const { data: account } = await supabase.from('accounts').select('email').eq('user_key', userKey).maybeSingle();
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: account.email, password: currentPassword });
    if (signInErr) return res.status(401).json({ error: 'Your current password is incorrect.' });
    const { error: updErr } = await supabase.auth.admin.updateUserById(userKey, { password: newPassword });
    if (updErr) throw updErr;
    return res.status(200).json({ ok: true });
  } catch (err) { return sendError(res, err, 'Could not change your password.'); }
}

async function handleAuthDeleteAccount(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { userKey } = await requireIdentity(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const password = String(body.password || '');
    if (!password) return res.status(400).json({ error: 'Password confirmation is required.' });
    const { data: account } = await supabase.from('accounts').select('email').eq('user_key', userKey).maybeSingle();
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: account.email, password });
    if (signInErr) return res.status(401).json({ error: 'Incorrect password.' });
    await Promise.all([
      supabase.from('progress').delete().eq('user_key', userKey),
      supabase.from('submissions').delete().eq('user_key', userKey),
      supabase.from('user_achievements').delete().eq('user_key', userKey),
      supabase.from('profiles').delete().eq('user_key', userKey),
      supabase.from('otps').delete().eq('email', account.email),
      supabase.from('accounts').delete().eq('user_key', userKey),
    ]);
    const { error: delErr } = await supabase.auth.admin.deleteUser(userKey);
    if (delErr) console.error('auth delete error:', delErr);
    return res.status(200).json({ ok: true });
  } catch (err) { return sendError(res, err, 'Could not delete your account.'); }
}

async function handleAuthMe(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { userKey } = await requireIdentity(req);
    const { data: account, error } = await supabase.from('accounts').select('username, email, email_verified, created_at').eq('user_key', userKey).maybeSingle();
    if (error) throw error;
    if (!account) return res.status(200).json({ username: null, email: null, email_verified: true, created_at: null, is_google: true });
    return res.status(200).json(account);
  } catch (err) { return sendError(res, err, 'Could not load account info.'); }
}

/* ─── router ─── */
const ROUTES = {
  'languages': handleLanguages,
  'curriculum': handleCurriculum,
  'lesson': handleLesson,
  'run': handleRun,
  'progress': handleProgress,
  'me': handleMe,
  'submissions': handleSubmissions,
  'leaderboard': handleLeaderboard,
  'stats': handleStats,
};

const AUTH_ROUTES = {
  'login': handleAuthLogin,
  'signup': handleAuthSignup,
  'verify-otp': handleAuthVerifyOtp,
  'forgot-password': handleAuthForgotPassword,
  'resend-otp': handleAuthResendOtp,
  'change-password': handleAuthChangePassword,
  'delete-account': handleAuthDeleteAccount,
  'me': handleAuthMe,
};

export default async function handler(req, res) {
  const path = req.query.path || [];
  const segments = Array.isArray(path) ? path : [path];

  if (segments.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  // /api/auth/*
  if (segments[0] === 'auth' && segments.length >= 2) {
    const handler = AUTH_ROUTES[segments[1]];
    if (handler) return handler(req, res);
    return res.status(404).json({ error: 'Not found' });
  }

  // /api/*
  const handler = ROUTES[segments[0]];
  if (handler) return handler(req, res);

  return res.status(404).json({ error: 'Not found' });
}
