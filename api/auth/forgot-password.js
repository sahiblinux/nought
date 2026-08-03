import supabase from '../db-client.js';
import { applyCors, sendError } from '../_auth.js';
import { sendEmail, tempPasswordEmail } from '../_email.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();

    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required.' });
    }

    // Verify username + email match
    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .select('user_key, email, username')
      .eq('username', username)
      .eq('email', email)
      .maybeSingle();
    if (accErr) throw accErr;

    if (!account) {
      return res.status(404).json({ error: 'No account matches that username and email.' });
    }

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(6).toString('base64url').slice(0, 10);

    // Update the user's password via admin API
    const { error: updErr } = await supabase.auth.admin.updateUserById(account.user_key, {
      password: tempPassword,
    });
    if (updErr) throw updErr;

    // Send email
    const emailResult = await sendEmail({
      to: account.email,
      ...tempPasswordEmail(tempPassword),
    });

    return res.status(200).json({
      ok: true,
      dev_password: emailResult.dev ? tempPassword : undefined,
    });
  } catch (err) {
    return sendError(res, err, 'Could not reset your password.');
  }
}
