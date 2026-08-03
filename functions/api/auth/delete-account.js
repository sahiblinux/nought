import { createSupabase, json, optionsResponse, errorResponse, requireIdentity, getBody } from '../_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const supabase = createSupabase(context.env);
  try {
    const { userKey } = await requireIdentity(context.request, supabase);
    const body = await getBody(context.request);
    const password = String(body.password || '');
    if (!password) return json({ error: 'Password confirmation is required.' }, 400);

    const { data: account } = await supabase.from('accounts').select('email').eq('user_key', userKey).maybeSingle();
    if (!account) return json({ error: 'Account not found.' }, 404);

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: account.email, password });
    if (signInErr) return json({ error: 'Incorrect password.' }, 401);

    await Promise.all([
      supabase.from('progress').delete().eq('user_key', userKey),
      supabase.from('submissions').delete().eq('user_key', userKey),
      supabase.from('user_achievements').delete().eq('user_key', userKey),
      supabase.from('profiles').delete().eq('user_key', userKey),
      supabase.from('otps').delete().eq('email', account.email),
      supabase.from('accounts').delete().eq('user_key', userKey),
    ]);

    const { error: delErr } = await supabase.auth.admin.deleteUser(userKey);
    if (delErr) console.error('auth delete error:', delErr);

    return json({ ok: true });
  } catch (err) {
    return errorResponse(err, 'Could not delete your account.');
  }
}
