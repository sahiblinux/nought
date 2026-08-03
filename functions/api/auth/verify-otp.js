import { createSupabase, json, optionsResponse, errorResponse, getBody } from '../_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const supabase = createSupabase(context.env);
  try {
    const body = await getBody(context.request);
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    if (!email || !code) return json({ error: 'Email and code are required.' }, 400);

    const { data: otp, error: otpErr } = await supabase
      .from('otps').select('id,expires_at,used').eq('email', email).eq('code', code)
      .eq('purpose', 'signup').eq('used', false).order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (otpErr) throw otpErr;
    if (!otp) return json({ error: 'Invalid verification code.' }, 400);
    if (new Date(otp.expires_at) < new Date()) return json({ error: 'That code has expired. Request a new one.' }, 400);

    await supabase.from('otps').update({ used: true }).eq('id', otp.id);

    const { data: account, error: accErr } = await supabase
      .from('accounts').update({ email_verified: true }).eq('email', email).select('user_key').single();
    if (accErr) throw accErr;

    if (account?.user_key) {
      await supabase.auth.admin.updateUserById(account.user_key, { email_confirm: true });
    }

    return json({ verified: true });
  } catch (err) {
    return errorResponse(err, 'Could not verify your code.');
  }
}
