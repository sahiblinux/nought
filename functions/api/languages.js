import { createSupabase, json, optionsResponse, errorResponse } from './_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const supabase = createSupabase(context.env);
  try {
    const { data: languages, error } = await supabase
      .from('languages').select('*').order('sort_order', { ascending: true });
    if (error) throw error;

    const out = await Promise.all(
      (languages || []).map(async (l) => {
        const [{ count: lessonCount }, { count: moduleCount }] = await Promise.all([
          supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('language_slug', l.slug),
          supabase.from('modules').select('id', { count: 'exact', head: true }).eq('language_slug', l.slug),
        ]);
        return { ...l, lesson_count: lessonCount || 0, module_count: moduleCount || 0 };
      })
    );

    return json(out, 200, { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' });
  } catch (err) {
    return errorResponse(err, 'Could not load the languages.');
  }
}
