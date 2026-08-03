import supabase from './db-client.js';

/**
 * Identity resolution.
 *
 * The rule: a signed-in user's key is ALWAYS derived from a verified JWT and is
 * never read from the request body or query string. Guests get a namespaced
 * random key that cannot collide with a Supabase auth UUID, so a guest can
 * never address a real account's rows.
 */

const GUEST_RE = /^guest_[a-z0-9]{6,32}$/;

export function applyCors(req, res, methods = 'GET, POST, OPTIONS') {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', `${methods}`);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Guest-Key');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  if (!h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

function guestFrom(req) {
  const raw = String(req.headers['x-guest-key'] || req.query?.guest_key || '').trim();
  return GUEST_RE.test(raw) ? raw : '';
}

/**
 * Returns { userKey, isGuest, email, displayName } or null when the caller
 * presented no usable identity at all.
 *
 * Throws { status: 401 } when a token was supplied but is invalid/expired, so
 * the client can refresh rather than silently writing to a guest row.
 */
export async function resolveIdentity(req) {
  const token = bearer(req);

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      const err = new Error('Session expired. Please sign in again.');
      err.status = 401;
      throw err;
    }
    const u = data.user;
    return {
      userKey: u.id,
      isGuest: false,
      email: u.email || null,
      displayName:
        u.user_metadata?.full_name ||
        u.user_metadata?.name ||
        (u.email ? u.email.split('@')[0] : 'Learner'),
    };
  }

  const guest = guestFrom(req);
  if (guest) {
    return { userKey: guest, isGuest: true, email: null, displayName: 'Guest learner' };
  }

  return null;
}

/** Same as resolveIdentity but 401s when there is no identity at all. */
export async function requireIdentity(req) {
  const id = await resolveIdentity(req);
  if (!id) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return id;
}

export function sendError(res, err, fallback = 'Something went wrong.') {
  const status = err?.status || 500;
  if (status >= 500) console.error('api error:', err);
  return res.status(status).json({ error: status >= 500 ? fallback : err.message });
}

/** Only a guest key is a valid migration source. */
export const isGuestKey = (k) => GUEST_RE.test(String(k || ''));
