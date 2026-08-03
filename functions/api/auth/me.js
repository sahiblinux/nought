import { createSupabase, json, optionsResponse, errorResponse, requireIdentity } from '../_lib.js';

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestGet(context) {
  const supabase = createSupabase(context.env);
  try {
    const { userKey } = await requireIdentity(context.request, supabase);

    const { data: account, error } = await supabase
      .from('accounts').select('username, email, email_verified, created_at').eq('user_key', userKey).maybeSingle();
    if (error) throw error;

    if (!account) {
      return json({ username: null, email: null, email_verified: true, created_at: null, is_google: true });
    }

    return json(account);
  } catch (err) {
    return errorResponse(err, 'Could not load account info.');
  }
}
