import { createSupabase, json, optionsResponse, errorResponse, requireIdentity, getBody } from '../_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const supabase = createSupabase(context.env);
  try {
    const { userKey } = await requireIdentity(context.request, supabase);
    const body = await getBody(context.request);
    const currentPassword = String(body.current_password || '');
    const newPassword = String(body.new_password || '');

    if (!currentPassword || !newPassword) return json({ error: 'Both passwords are required.' }, 400);
    if (newPassword.length < 6) return json({ error: 'New password must be at least 6 characters.' }, 400);
    if (currentPassword === newPassword) return json({ error: 'New password must be different from the current one.' }, 400);

    const { data: account } = await supabase.from('accounts').select('email').eq('user_key', userKey).maybeSingle();
    if (!account) return json({ error: 'Account not found.' }, 404);

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: account.email, password: currentPassword });
    if (signInErr) return json({ error: 'Your current password is incorrect.' }, 401);

    const { error: updErr } = await supabase.auth.admin.updateUserById(userKey, { password: newPassword });
    if (updErr) throw updErr;

    return json({ ok: true });
  } catch (err) {
    return errorResponse(err, 'Could not change your password.');
  }
}
