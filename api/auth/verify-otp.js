import supabase from '../db-client.js';
import { applyCors, sendError } from '../_auth.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required.' });
    }

    // Find the most recent unused OTP
    const { data: otp, error: otpErr } = await supabase
      .from('otps')
      .select('id,expires_at,used')
      .eq('email', email)
      .eq('code', code)
      .eq('purpose', 'signup')
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (otpErr) throw otpErr;

    if (!otp) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }
    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ error: 'That code has expired. Request a new one.' });
    }

    // Mark OTP as used
    await supabase.from('otps').update({ used: true }).eq('id', otp.id);

    // Mark email as verified in accounts
    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .update({ email_verified: true })
      .eq('email', email)
      .select('user_key')
      .single();
    if (accErr) throw accErr;

    // Confirm email in Supabase Auth
    if (account?.user_key) {
      await supabase.auth.admin.updateUserById(account.user_key, { email_confirm: true });
    }

    return res.status(200).json({ verified: true });
  } catch (err) {
    return sendError(res, err, 'Could not verify your code.');
  }
}
