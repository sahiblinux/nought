import supabase from './db-client.js';
import { applyCors, sendError } from './_auth.js';

/**
 * Per-language totals.
 *
 * These are computed with head+count queries rather than by fetching every
 * lesson row: PostgREST caps a plain select at 1000 rows, so summing a
 * 1595-lesson table client-side silently under-reports.
 */
export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { data: languages, error } = await supabase
      .from('languages')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;

    const out = await Promise.all(
      (languages || []).map(async (l) => {
        const [{ count: lessonCount }, { count: moduleCount }] = await Promise.all([
          supabase
            .from('lessons')
            .select('id', { count: 'exact', head: true })
            .eq('language_slug', l.slug),
          supabase
            .from('modules')
            .select('id', { count: 'exact', head: true })
            .eq('language_slug', l.slug),
        ]);

        return {
          ...l,
          lesson_count: lessonCount || 0,
          module_count: moduleCount || 0,
        };
      })
    );

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(out);
  } catch (err) {
    return sendError(res, err, 'Could not load the languages.');
  }
}
