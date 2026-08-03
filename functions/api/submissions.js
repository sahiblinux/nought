import { createSupabase, json, optionsResponse, requireIdentity, errorResponse } from './_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const supabase = createSupabase(context.env);
  try {
    const { userKey } = await requireIdentity(context.request, supabase);

    const { data, error } = await supabase
      .from('submissions').select('id,lesson_id,language_slug,passed,created_at')
      .eq('user_key', userKey).order('created_at', { ascending: false }).limit(40);
    if (error) throw error;

    const ids = [...new Set((data || []).map((d) => d.lesson_id))];
    let titles = {};
    if (ids.length) {
      const { data: lessons } = await supabase
        .from('lessons').select('id,title,slug,language_slug').in('id', ids);
      titles = Object.fromEntries((lessons || []).map((l) => [l.id, l]));
    }

    return json(
      (data || []).map((s) => ({
        ...s,
        lesson_title: titles[s.lesson_id]?.title || 'Lesson',
        lesson_slug: titles[s.lesson_id]?.slug || '',
      }))
    );
  } catch (err) {
    return errorResponse(err, 'Could not load your recent runs.');
  }
}
