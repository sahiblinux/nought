import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/^\/api\//, ''); // e.g. "todos", "users/123"
  const segments = path.split('/').filter(Boolean);

  try {
    // GET /api/todos
    if (segments[0] === 'todos' && req.method === 'GET') {
      const { data, error } = await supabase.from('todos').select('*').order('id', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data);
    }

    // POST /api/todos
    if (segments[0] === 'todos' && req.method === 'POST') {
      const { title } = req.body;
      const { data, error } = await supabase.from('todos').insert({ title }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    // DELETE /api/todos/:id
    if (segments[0] === 'todos' && req.method === 'DELETE') {
      const id = segments[1];
      const { error } = await supabase.from('todos').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // Add all your other routes here the same way...

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
}