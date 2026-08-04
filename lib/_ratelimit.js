import supabase from './db-client.js';

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

export const LIMITS = {
  perMinute: Number(process.env.RUN_LIMIT_PER_MINUTE || 12),
  perDay: Number(process.env.RUN_LIMIT_PER_DAY || 400),
};

export async function checkRunLimit(userKey, ip) {
  if (!memAllow(`${userKey}|${ip}`)) {
    return {
      ok: false,
      status: 429,
      message: 'Slow down a moment — too many runs in a few seconds.',
      retryAfter: 10,
    };
  }

  const nowIso = new Date().toISOString();
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  try {
    const [{ count: lastMinute }, { count: lastDay }] = await Promise.all([
      supabase
        .from('run_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_key', userKey)
        .gte('created_at', minuteAgo),
      supabase
        .from('run_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_key', userKey)
        .gte('created_at', dayAgo),
    ]);

    if ((lastMinute || 0) >= LIMITS.perMinute) {
      return {
        ok: false,
        status: 429,
        message: `Rate limit reached (${LIMITS.perMinute} runs per minute). Try again shortly.`,
        retryAfter: 30,
      };
    }
    if ((lastDay || 0) >= LIMITS.perDay) {
      return {
        ok: false,
        status: 429,
        message: `Daily run limit reached (${LIMITS.perDay}). It resets 24 hours after your first run today.`,
        retryAfter: 3600,
      };
    }

    await supabase.from('run_events').insert({ user_key: userKey, created_at: nowIso });

    if (Math.random() < 0.02) {
      await supabase
        .from('run_events')
        .delete()
        .lt('created_at', new Date(Date.now() - 2 * 86_400_000).toISOString());
    }
  } catch (e) {
    console.error('rate limit check failed (allowing):', e.message);
  }

  return { ok: true };
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}
