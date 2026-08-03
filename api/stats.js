import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [learners, lessons, languages, completions, runs] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('lessons').select('id', { count: 'exact', head: true }),
      supabase.from('languages').select('id', { count: 'exact', head: true }),
      supabase
        .from('progress')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }),
    ]);

    return res.status(200).json({
      learners: learners.count || 0,
      lessons: lessons.count || 0,
      languages: languages.count || 0,
      completions: completions.count || 0,
      runs: runs.count || 0,
    });
  } catch (err) {
    console.error('stats error:', err);
    return res.status(500).json({ error: err.message });
  }
}
