import { createSupabase, json, optionsResponse, resolveIdentity, errorResponse } from './_lib.js';

async function opaque(key) {
  const data = new TextEncoder().encode(`nought:${key}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const supabase = createSupabase(context.env);
  try {
    let me = null;
    try {
      const id = await resolveIdentity(context.request, supabase);
      me = id?.userKey || null;
    } catch { me = null; }

    const { data, error } = await supabase
      .from('profiles').select('user_key,display_name,xp,streak,lessons_done')
      .gt('xp', 0).order('xp', { ascending: false }).limit(25);
    if (error) throw error;

    const results = await Promise.all(
      (data || []).map(async (r) => ({
        id: await opaque(r.user_key),
        display_name: r.display_name || 'Learner',
        xp: r.xp || 0, streak: r.streak || 0,
        lessons_done: r.lessons_done || 0,
        is_me: !!me && r.user_key === me,
      }))
    );
    return json(results);
  } catch (err) {
    return errorResponse(err, 'Could not load the leaderboard.');
  }
}
