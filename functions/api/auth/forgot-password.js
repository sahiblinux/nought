import { createSupabase, json, optionsResponse, errorResponse, getBody, sendEmailBestEffort, tempPasswordEmail } from '../_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const supabase = createSupabase(context.env);
  try {
    const body = await getBody(context.request);
    const username = String(body.username || '').trim().toLowerCase();
    const email = String(body.email || '').trim().toLowerCase();
    if (!username || !email) return json({ error: 'Username and email are required.' }, 400);

    const { data: account, error: accErr } = await supabase
      .from('accounts').select('user_key, email, username').eq('username', username).eq('email', email).maybeSingle();
    if (accErr) throw accErr;
    if (!account) return json({ error: 'No account matches that username and email.' }, 404);

    const tempPassword = crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + String.fromCharCode(b), '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);

    const { error: updErr } = await supabase.auth.admin.updateUserById(account.user_key, { password: tempPassword });
    if (updErr) throw updErr;

    // The password is already reset above; if email delivery fails, surface the
    // temp password on screen so the user isn't locked out.
    const emailResult = await sendEmailBestEffort({ to: account.email, ...tempPasswordEmail(tempPassword) }, context.env);

    return json({ ok: true, dev_password: emailResult.dev ? tempPassword : undefined });
  } catch (err) {
    return errorResponse(err, 'Could not reset your password.');
  }
}
