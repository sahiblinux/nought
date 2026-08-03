import { createSupabase, json, optionsResponse, requireIdentity, isGuestKey, errorResponse, getQuery } from './_lib.js';

const today = () => new Date().toISOString().slice(0, 10);

async function ensureProfile(supabase, { userKey, displayName, email }) {
  const { data: existing, error } = await supabase
    .from('profiles').select('*').eq('user_key', userKey).maybeSingle();
  if (error) throw error;

  if (existing) {
    const wants = {};
    if (displayName && displayName !== existing.display_name) wants.display_name = displayName;
    if (email && email !== existing.email) wants.email = email;
    if (!Object.keys(wants).length) return existing;
    const { data: upd } = await supabase
      .from('profiles').update(wants).eq('user_key', userKey).select().single();
    return upd || existing;
  }

  const { data: created, error: cErr } = await supabase
    .from('profiles').insert({
      user_key: userKey, display_name: displayName || 'Learner',
      email: email || null, xp: 0, streak: 0, hearts: 5,
      lessons_done: 0, last_active: today(), created_at: new Date().toISOString(),
    }).select().single();
  if (cErr) throw cErr;
  return created;
}

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const supabase = createSupabase(context.env);
  const query = getQuery(context.request);
  try {
    const identity = await requireIdentity(context.request, supabase);
    const { userKey, isGuest } = identity;

    let profile = await ensureProfile(supabase, identity);

    // Guest -> account migration
    const migrateFrom = String(query.migrate_from || '');
    if (!isGuest && isGuestKey(migrateFrom) && migrateFrom !== userKey && (profile.xp || 0) === 0) {
      const { data: mine } = await supabase.from('progress').select('id').eq('user_key', userKey).limit(1);
      if (!mine || mine.length === 0) {
        const { data: old } = await supabase.from('profiles').select('*').eq('user_key', migrateFrom).maybeSingle();
        await supabase.from('progress').update({ user_key: userKey }).eq('user_key', migrateFrom);
        await supabase.from('submissions').update({ user_key: userKey }).eq('user_key', migrateFrom);
        await supabase.from('user_achievements').update({ user_key: userKey }).eq('user_key', migrateFrom);
        if (old) {
          const { data: upd } = await supabase.from('profiles').update({
            xp: old.xp || 0, streak: old.streak || 0, hearts: old.hearts ?? 5,
            lessons_done: old.lessons_done || 0, last_active: old.last_active || today(),
          }).eq('user_key', userKey).select().single();
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

    return json({
      profile, isGuest, progress: progress || [],
      achievements: (achievements || []).map((a) => ({
        ...a, earned: earnedMap.has(a.slug), earned_at: earnedMap.get(a.slug) || null,
      })),
    });
  } catch (err) {
    return errorResponse(err, 'Could not load your progress.');
  }
}
