import { createSupabase, json, optionsResponse, errorResponse, getBody } from '../_lib.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const supabase = createSupabase(context.env);
  try {
    const body = await getBody(context.request);
    const username = String(body.username || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!USERNAME_RE.test(username)) return json({ error: 'Username must be 3–20 letters, numbers, or underscores.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
    if (password.length < 6) return json({ error: 'Password must be at least 6 characters.' }, 400);

    const { data: existingUser } = await supabase.from('accounts').select('id').eq('username', username).maybeSingle();
    if (existingUser) return json({ error: 'That username is taken.' }, 409);

    const { data: existingEmail } = await supabase.from('accounts').select('id').eq('email', email).maybeSingle();
    if (existingEmail) return json({ error: 'An account with that email already exists.' }, 409);

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { username },
    });
    if (authErr) {
      if (authErr.message.includes('already')) return json({ error: 'An account with that email already exists.' }, 409);
      throw authErr;
    }

    const userKey = authData.user.id;
    const { error: accErr } = await supabase.from('accounts').insert({
      username, email, user_key: userKey, email_verified: true,
    });
    if (accErr) throw accErr;

    await supabase.from('profiles').insert({
      user_key: userKey, display_name: username, email, xp: 0, streak: 0,
      hearts: 5, lessons_done: 0, last_active: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    });

    return json({ ok: true, email }, 201);
  } catch (err) {
    return errorResponse(err, 'Could not create your account.');
  }
}
