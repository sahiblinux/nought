import { createSupabase, json, optionsResponse, errorResponse, getBody, sendEmailBestEffort, otpEmail } from '../_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const supabase = createSupabase(context.env);
  try {
    const body = await getBody(context.request);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return json({ error: 'Email is required.' }, 400);

    const { data: recent } = await supabase
      .from('otps').select('created_at').eq('email', email).eq('purpose', 'signup')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (recent && new Date(recent.created_at) > new Date(Date.now() - 30_000)) {
      return json({ error: 'Please wait a moment before requesting another code.' }, 429);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('otps').insert({ email, code, purpose: 'signup', expires_at: expiresAt, used: false });

    const emailResult = await sendEmailBestEffort({ to: email, ...otpEmail(code) }, context.env);

    return json({ ok: true, dev_otp: emailResult.dev ? code : undefined });
  } catch (err) {
    return errorResponse(err, 'Could not resend the code.');
  }
}
