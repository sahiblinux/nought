import { createSupabase, json, optionsResponse } from './_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const supabase = createSupabase(context.env);
  try {
    const [learners, lessons, languages, completions, runs] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('lessons').select('id', { count: 'exact', head: true }),
      supabase.from('languages').select('id', { count: 'exact', head: true }),
      supabase.from('progress').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }),
    ]);

    return json({
      learners: learners.count || 0, lessons: lessons.count || 0,
      languages: languages.count || 0, completions: completions.count || 0,
      runs: runs.count || 0,
    });
  } catch (err) {
    console.error('stats error:', err);
    return json({ error: err.message }, 500);
  }
}
