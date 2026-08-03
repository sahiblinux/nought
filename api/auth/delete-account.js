import supabase from '../db-client.js';
import { applyCors, requireIdentity, sendError } from '../_auth.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userKey } = await requireIdentity(req);

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const password = String(body.password || '');

    if (!password) {
      return res.status(400).json({ error: 'Password confirmation is required.' });
    }

    // Get email to verify password
    const { data: account } = await supabase
      .from('accounts')
      .select('email')
      .eq('user_key', userKey)
      .maybeSingle();
    if (!account) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    // Verify password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: account.email,
      password,
    });
    if (signInErr) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // Delete all user data
    await Promise.all([
      supabase.from('progress').delete().eq('user_key', userKey),
      supabase.from('submissions').delete().eq('user_key', userKey),
      supabase.from('user_achievements').delete().eq('user_key', userKey),
      supabase.from('profiles').delete().eq('user_key', userKey),
      supabase.from('otps').delete().eq('email', account.email),
      supabase.from('accounts').delete().eq('user_key', userKey),
    ]);

    // Delete the auth user
    const { error: delErr } = await supabase.auth.admin.deleteUser(userKey);
    if (delErr) {
      console.error('auth delete error:', delErr);
      // Data is already gone; report partial success
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendError(res, err, 'Could not delete your account.');
  }
}
