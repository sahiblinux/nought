import { createSupabase, json, optionsResponse, getQuery } from './_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const supabase = createSupabase(context.env);
  const query = getQuery(context.request);
  try {
    const slug = String(query.language || '');
    if (!slug) return json({ error: 'language query param required' }, 400);

    const { data: language, error: lErr } = await supabase
      .from('languages').select('*').eq('slug', slug).maybeSingle();
    if (lErr) throw lErr;
    if (!language) return json({ error: 'Language not found' }, 404);

    const { data: modules, error: mErr } = await supabase
      .from('modules').select('*').eq('language_slug', slug).order('sort_order', { ascending: true });
    if (mErr) throw mErr;

    const { data: lessons, error: sErr } = await supabase
      .from('lessons').select('id,language_slug,module_slug,slug,title,subtitle,kind,xp,sort_order')
      .eq('language_slug', slug).order('sort_order', { ascending: true }).limit(2000);
    if (sErr) throw sErr;

    return json({ language, modules: modules || [], lessons: lessons || [] });
  } catch (err) {
    console.error('curriculum error:', err);
    return json({ error: err.message }, 500);
  }
}
