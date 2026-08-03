import supabase from '../db-client.js';
import { applyCors, sendError } from '../_auth.js';
import { sendEmail, otpEmail } from '../_email.js';
import crypto from 'crypto';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Username must be 3–20 letters, numbers, or underscores.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check username uniqueness
    const { data: existingUser } = await supabase
      .from('accounts')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (existingUser) {
      return res.status(409).json({ error: 'That username is taken.' });
    }

    // Check email uniqueness
    const { data: existingEmail } = await supabase
      .from('accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existingEmail) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    // Create the Supabase auth user (unconfirmed)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { username },
    });
    if (authErr) {
      if (authErr.message.includes('already')) {
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }
      throw authErr;
    }

    const userKey = authData.user.id;

    // Insert into accounts table
    const { error: accErr } = await supabase.from('accounts').insert({
      username,
      email,
      user_key: userKey,
      email_verified: false,
    });
    if (accErr) throw accErr;

    // Create profile
    await supabase.from('profiles').insert({
      user_key: userKey,
      display_name: username,
      email,
      xp: 0,
      streak: 0,
      hearts: 5,
      lessons_done: 0,
      last_active: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    });

    // Generate OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('otps').insert({
      email,
      code,
      purpose: 'signup',
      expires_at: expiresAt,
      used: false,
    });

    // Send email
    const emailResult = await sendEmail({ to: email, ...otpEmail(code) });

    return res.status(201).json({
      ok: true,
      email,
      dev_otp: emailResult.dev ? code : undefined,
    });
  } catch (err) {
    return sendError(res, err, 'Could not create your account.');
  }
}
