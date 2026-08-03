import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const slug = String(req.query.language || '');
    if (!slug) return res.status(400).json({ error: 'language query param required' });

    const { data: language, error: lErr } = await supabase
      .from('languages')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (lErr) throw lErr;
    if (!language) return res.status(404).json({ error: 'Language not found' });

    const { data: modules, error: mErr } = await supabase
      .from('modules')
      .select('*')
      .eq('language_slug', slug)
      .order('sort_order', { ascending: true });
    if (mErr) throw mErr;

    const { data: lessons, error: sErr } = await supabase
      .from('lessons')
      .select('id,language_slug,module_slug,slug,title,subtitle,kind,xp,sort_order')
      .eq('language_slug', slug)
      .order('sort_order', { ascending: true })
      .limit(2000);
    if (sErr) throw sErr;

    return res.status(200).json({ language, modules: modules || [], lessons: lessons || [] });
  } catch (err) {
    console.error('curriculum error:', err);
    return res.status(500).json({ error: err.message });
  }
}
