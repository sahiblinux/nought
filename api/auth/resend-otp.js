import supabase from '../db-client.js';
import { applyCors, sendError } from '../_auth.js';
import { sendEmail, otpEmail } from '../_email.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const email = String(body.email || '').trim().toLowerCase();

    if (!email) return res.status(400).json({ error: 'Email is required.' });

    // Rate limit: max 1 resend per 30s
    const { data: recent } = await supabase
      .from('otps')
      .select('created_at')
      .eq('email', email)
      .eq('purpose', 'signup')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent && new Date(recent.created_at) > new Date(Date.now() - 30_000)) {
      return res.status(429).json({ error: 'Please wait a moment before requesting another code.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('otps').insert({
      email,
      code,
      purpose: 'signup',
      expires_at: expiresAt,
      used: false,
    });

    const emailResult = await sendEmail({ to: email, ...otpEmail(code) });

    return res.status(200).json({
      ok: true,
      dev_otp: emailResult.dev ? code : undefined,
    });
  } catch (err) {
    return sendError(res, err, 'Could not resend the code.');
  }
}
