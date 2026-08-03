import supabase from '../db-client.js';
import { applyCors, requireIdentity, sendError } from '../_auth.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userKey } = await requireIdentity(req);

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const currentPassword = String(body.current_password || '');
    const newPassword = String(body.new_password || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both passwords are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from the current one.' });
    }

    // Get the user's email to verify current password
    const { data: account } = await supabase
      .from('accounts')
      .select('email')
      .eq('user_key', userKey)
      .maybeSingle();
    if (!account) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    // Verify current password by attempting sign-in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: currentPassword,
    });
    if (signInErr) {
      return res.status(401).json({ error: 'Your current password is incorrect.' });
    }

    // Update password
    const { error: updErr } = await supabase.auth.admin.updateUserById(userKey, {
      password: newPassword,
    });
    if (updErr) throw updErr;

    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendError(res, err, 'Could not change your password.');
  }
}
