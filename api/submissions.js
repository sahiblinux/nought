import supabase from './db-client.js';
import { applyCors, requireIdentity, sendError } from './_auth.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userKey } = await requireIdentity(req);

    const { data, error } = await supabase
      .from('submissions')
      .select('id,lesson_id,language_slug,passed,created_at')
      .eq('user_key', userKey)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) throw error;

    const ids = [...new Set((data || []).map((d) => d.lesson_id))];
    let titles = {};
    if (ids.length) {
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id,title,slug,language_slug')
        .in('id', ids);
      titles = Object.fromEntries((lessons || []).map((l) => [l.id, l]));
    }

    return res.status(200).json(
      (data || []).map((s) => ({
        ...s,
        lesson_title: titles[s.lesson_id]?.title || 'Lesson',
        lesson_slug: titles[s.lesson_id]?.slug || '',
      }))
    );
  } catch (err) {
    return sendError(res, err, 'Could not load your recent runs.');
  }
}
