import { createSupabase, json, optionsResponse, errorResponse, getBody } from '../_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const supabase = createSupabase(context.env);
  try {
    const body = await getBody(context.request);
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!username || !password) return json({ error: 'Username and password are required.' }, 400);

    const { data: account, error: accErr } = await supabase
      .from('accounts').select('email, email_verified, user_key').eq('username', username).maybeSingle();
    if (accErr) throw accErr;
    if (!account) return json({ error: 'No account found with that username.' }, 401);
    if (!account.email_verified) return json({
      error: 'Please verify your email first. Check your inbox for the code.',
      needs_verification: true, email: account.email,
    }, 403);

    const { data, error } = await supabase.auth.signInWithPassword({ email: account.email, password });
    if (error) return json({ error: 'Incorrect password.' }, 401);

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (err) {
    return errorResponse(err, 'Could not sign you in.');
  }
}
