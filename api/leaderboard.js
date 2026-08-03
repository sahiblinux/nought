import supabase from './db-client.js';
import { applyCors, resolveIdentity, sendError } from './_auth.js';

import crypto from 'crypto';

/** Opaque, stable per-row id so the client can highlight "you" without ever
 *  receiving another learner's real user key. */
const opaque = (key) =>
  crypto.createHash('sha256').update(`nought:${key}`).digest('hex').slice(0, 12);

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let me = null;
    try {
      const id = await resolveIdentity(req);
      me = id?.userKey || null;
    } catch {
      me = null; // an expired token should not break a public page
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('user_key,display_name,xp,streak,lessons_done')
      .gt('xp', 0)
      .order('xp', { ascending: false })
      .limit(25);
    if (error) throw error;

    return res.status(200).json(
      (data || []).map((r) => ({
        id: opaque(r.user_key),
        display_name: r.display_name || 'Learner',
        xp: r.xp || 0,
        streak: r.streak || 0,
        lessons_done: r.lessons_done || 0,
        is_me: !!me && r.user_key === me,
      }))
    );
  } catch (err) {
    return sendError(res, err, 'Could not load the leaderboard.');
  }
}
