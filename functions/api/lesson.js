import { createSupabase, json, optionsResponse, getQuery } from './_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const supabase = createSupabase(context.env);
  const query = getQuery(context.request);
  try {
    const language = String(query.language || '');
    const slug = String(query.slug || '');
    if (!language || !slug) return json({ error: 'language and slug required' }, 400);

    const { data: lesson, error } = await supabase
      .from('lessons').select('*').eq('language_slug', language).eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!lesson) return json({ error: 'Lesson not found' }, 404);

    const [{ data: order }, { data: lang }, { data: mod }] = await Promise.all([
      supabase.from('lessons').select('id,slug,title,kind,sort_order,module_slug,xp')
        .eq('language_slug', language).order('sort_order', { ascending: true }).limit(2000),
      supabase.from('languages').select('*').eq('slug', language).maybeSingle(),
      supabase.from('modules').select('*').eq('language_slug', language).eq('slug', lesson.module_slug).maybeSingle(),
    ]);

    const flat = order || [];
    const idx = flat.findIndex((l) => l.id === lesson.id);

    return json({
      lesson, language: lang || null, module: mod || null, flat, index: idx,
      prev: idx > 0 ? flat[idx - 1] : null,
      next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null,
    });
  } catch (err) {
    console.error('lesson error:', err);
    return json({ error: err.message }, 500);
  }
}
