import supabase from '../db-client.js';
import { applyCors, requireIdentity, sendError } from '../_auth.js';

/** Returns the account info (username, email, email_verified) for the
 *  signed-in user. */
export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userKey } = await requireIdentity(req);

    const { data: account, error } = await supabase
      .from('accounts')
      .select('username, email, email_verified, created_at')
      .eq('user_key', userKey)
      .maybeSingle();
    if (error) throw error;

    if (!account) {
 // Google sign-in users don't have an accounts row yet
      return res.status(200).json({
        username: null,
        email: null,
        email_verified: true,
        created_at: null,
        is_google: true,
      });
    }

    return res.status(200).json(account);
  } catch (err) {
    return sendError(res, err, 'Could not load account info.');
  }
}
