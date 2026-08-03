import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const language = String(req.query.language || '');
    const slug = String(req.query.slug || '');
    if (!language || !slug) return res.status(400).json({ error: 'language and slug required' });

    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('language_slug', language)
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const [{ data: order }, { data: lang }, { data: mod }] = await Promise.all([
      supabase
        .from('lessons')
        .select('id,slug,title,kind,sort_order,module_slug,xp')
        .eq('language_slug', language)
        .order('sort_order', { ascending: true })
        .limit(2000),
      supabase.from('languages').select('*').eq('slug', language).maybeSingle(),
      supabase
        .from('modules')
        .select('*')
        .eq('language_slug', language)
        .eq('slug', lesson.module_slug)
        .maybeSingle(),
    ]);

    const flat = order || [];
    const idx = flat.findIndex((l) => l.id === lesson.id);

    return res.status(200).json({
      lesson,
      language: lang || null,
      module: mod || null,
      flat,
      index: idx,
      prev: idx > 0 ? flat[idx - 1] : null,
      next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null,
    });
  } catch (err) {
    console.error('lesson error:', err);
    return res.status(500).json({ error: err.message });
  }
}
