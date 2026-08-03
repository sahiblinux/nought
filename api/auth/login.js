import supabase from '../db-client.js';
import { applyCors, sendError } from '../_auth.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Look up email by username
    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .select('email, email_verified, user_key')
      .eq('username', username)
      .maybeSingle();
    if (accErr) throw accErr;

    if (!account) {
      return res.status(401).json({ error: 'No account found with that username.' });
    }
    if (!account.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email first. Check your inbox for the code.',
        needs_verification: true,
        email: account.email,
      });
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password,
    });
    if (error) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    return res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (err) {
    return sendError(res, err, 'Could not sign you in.');
  }
}
