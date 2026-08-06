import { createClient } from '@supabase/supabase-js';

// ── Supabase client ────────────────────────────────────────
export function createSupabase(env) {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ── CORS ───────────────────────────────────────────────────
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-Key',
};

export function corsHeaders(methods = 'GET, POST, OPTIONS') {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-Key',
    Vary: 'Origin',
  };
}

// ── Response helpers ───────────────────────────────────────
export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extra },
  });
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function errorResponse(err, fallback = 'Something went wrong.') {
  const status = err?.status || 500;
  const msg = status >= 500 ? fallback : err.message;
  if (status >= 500) console.error('api error:', err);
  return json({ error: msg }, status);
}

// ── Request parsing ────────────────────────────────────────
export function getQuery(request) {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
}

export async function getBody(request) {
  const text = await request.text();
  try { return JSON.parse(text); } catch { return {}; }
}

// ── Auth / Identity ────────────────────────────────────────
const GUEST_RE = /^guest_[a-z0-9]{6,32}$/;

function bearer(request) {
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

function guestFrom(request) {
  const raw = String(request.headers.get('x-guest-key') || getQuery(request).guest_key || '').trim();
  return GUEST_RE.test(raw) ? raw : '';
}

export async function resolveIdentity(request, supabase) {
  const token = bearer(request);

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

  const guest = guestFrom(request);
  if (guest) {
    return { userKey: guest, isGuest: true, email: null, displayName: 'Guest learner' };
  }

  return null;
}

export async function requireIdentity(request, supabase) {
  const id = await resolveIdentity(request, supabase);
  if (!id) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return id;
}

export const isGuestKey = (k) => GUEST_RE.test(String(k || ''));

// ── Email ──────────────────────────────────────────────────
export async function sendEmail({ to, subject, html, text }, env) {
  const key = env.RESEND_API_KEY;
  if (!key) return { sent: false, dev: true };
  const FROM = env.MAIL_FROM || 'Nought <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('email send failed:', res.status, body);
    throw new Error('Could not send email.');
  }
  return { sent: true };
}

/** Best-effort send: if delivery fails (unverified sender, invalid key, etc.),
 *  fall back to dev mode so callers can show the code/temp password on screen
 *  instead of failing the whole request after rows were already written. */
export async function sendEmailBestEffort(msg, env) {
  try {
    return await sendEmail(msg, env);
  } catch (err) {
    console.error('email send failed, falling back to on-screen code:', err.message);
    return { sent: false, dev: true };
  }
}

export function otpEmail(code) {
  return {
    subject: `Your Nought verification code: ${code}`,
    text: `Welcome to Nought! Your verification code is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:Georgia,serif;max-width:420px;margin:0 auto;padding:32px 24px;background:#f5f3ef;border-radius:12px">
        <h1 style="font-size:22px;color:#1c1b17;margin:0 0 8px">Nought</h1>
        <p style="font-size:14px;color:#45423b;margin:0 0 24px">Verify your email address</p>
        <div style="text-align:center;background:#fbfaf8;border:1px solid #e2ded5;border-radius:8px;padding:24px;margin:0 0 24px">
          <p style="font-family:monospace;font-size:32px;letter-spacing:8px;color:#a1573a;margin:0">${code}</p>
        </div>
        <p style="font-size:13px;color:#837e74;margin:0">Enter this code to finish creating your account. It expires in 10 minutes.</p>
      </div>`,
  };
}

export function tempPasswordEmail(password) {
  return {
    subject: 'Your temporary Nought password',
    text: `Your temporary password is: ${password}. Sign in and go to Settings to change it.`,
    html: `
      <div style="font-family:Georgia,serif;max-width:420px;margin:0 auto;padding:32px 24px;background:#f5f3ef;border-radius:12px">
        <h1 style="font-size:22px;color:#1c1b17;margin:0 0 8px">Nought</h1>
        <p style="font-size:14px;color:#45423b;margin:0 0 24px">Password reset</p>
        <div style="text-align:center;background:#fbfaf8;border:1px solid #e2ded5;border-radius:8px;padding:24px;margin:0 0 24px">
          <p style="font-family:monospace;font-size:20px;color:#a1573a;margin:0">${password}</p>
        </div>
        <p style="font-size:13px;color:#837e74;margin:0">Sign in with your username and this password, then go to Settings to set a new one.</p>
      </div>`,
  };
}

// ── Rate limiting ─────────────────────────────────────────
const MEM = new Map();
const MEM_WINDOW_MS = 10_000;
const MEM_MAX = 6;

function memAllow(key) {
  const now = Date.now();
  const hits = (MEM.get(key) || []).filter((t) => now - t < MEM_WINDOW_MS);
  hits.push(now);
  MEM.set(key, hits);
  if (MEM.size > 500) {
    for (const [k, v] of MEM) {
      if (!v.length || now - v[v.length - 1] > 60_000) MEM.delete(k);
    }
  }
  return hits.length <= MEM_MAX;
}

export async function checkRunLimit(userKey, ip, supabase, env) {
  if (!memAllow(`${userKey}|${ip}`)) {
    return { ok: false, status: 429, message: 'Slow down a moment — too many runs in a few seconds.', retryAfter: 10 };
  }

  const perMinute = Number(env.RUN_LIMIT_PER_MINUTE || 12);
  const perDay = Number(env.RUN_LIMIT_PER_DAY || 400);
  const nowIso = new Date().toISOString();
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  try {
    const [{ count: lastMinute }, { count: lastDay }] = await Promise.all([
      supabase.from('run_events').select('id', { count: 'exact', head: true }).eq('user_key', userKey).gte('created_at', minuteAgo),
      supabase.from('run_events').select('id', { count: 'exact', head: true }).eq('user_key', userKey).gte('created_at', dayAgo),
    ]);

    if ((lastMinute || 0) >= perMinute) {
      return { ok: false, status: 429, message: `Rate limit reached (${perMinute} runs per minute). Try again shortly.`, retryAfter: 30 };
    }
    if ((lastDay || 0) >= perDay) {
      return { ok: false, status: 429, message: `Daily run limit reached (${perDay}). It resets 24 hours after your first run today.`, retryAfter: 3600 };
    }

    await supabase.from('run_events').insert({ user_key: userKey, created_at: nowIso });
    if (Math.random() < 0.02) {
      await supabase.from('run_events').delete().lt('created_at', new Date(Date.now() - 2 * 86_400_000).toISOString());
    }
  } catch (e) {
    console.error('rate limit check failed (allowing):', e.message);
  }

  return { ok: true };
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}
