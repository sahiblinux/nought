import { createSupabase, json, optionsResponse, resolveIdentity, errorResponse, checkRunLimit, clientIp, getBody } from './_lib.js';

const LANGS = {
  python: { id: 100, file: 'main.py' },
  c: { id: 103, file: 'main.c' },
  cpp: { id: 105, file: 'main.cpp' },
  java: { id: 91, file: 'Main.java' },
  rust: { id: 108, file: 'main.rs' },
};
const MAX_CODE_BYTES = 40_000;
const MAX_STDIN_BYTES = 8_000;

// Web API base64 (works without nodejs_compat)
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s ?? '')));
const unb64 = (s) => (s ? new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))) : '');

export async function onRequestOptions() { return optionsResponse(); }

export async function onRequestPost(context) {
  const supabase = createSupabase(context.env);
  const env = context.env;
  try {
    const identity = await resolveIdentity(context.request, supabase);
    const ip = clientIp(context.request);
    const limitKey = identity?.userKey || `ip_${ip}`;

    const gate = await checkRunLimit(limitKey, ip, supabase, env);
    if (!gate.ok) {
      return json({ error: gate.message, rateLimited: true }, gate.status, { 'Retry-After': String(gate.retryAfter || 30) });
    }

    const body = await getBody(context.request);
    const language = String(body.language || '');
    const code = String(body.code ?? '');
    const stdin = String(body.stdin ?? '');

    const spec = LANGS[language];
    if (!spec) return json({ error: `Unsupported language: ${language || '(none)'}` }, 400);
    if (!code.trim()) return json({ error: 'There is no code to run yet.' }, 400);
    if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) return json({ error: 'That program is too large to run here.' }, 413);

    const JUDGE0_URL = (env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/+$/, '');
    const JUDGE0_KEY = env.JUDGE0_KEY || '';
    const RAPIDAPI_HOST = env.JUDGE0_RAPIDAPI_HOST || '';

    const judgeHeaders = { 'Content-Type': 'application/json' };
    if (JUDGE0_KEY && RAPIDAPI_HOST) {
      judgeHeaders['X-RapidAPI-Key'] = JUDGE0_KEY;
      judgeHeaders['X-RapidAPI-Host'] = RAPIDAPI_HOST;
    } else if (JUDGE0_KEY) {
      judgeHeaders['X-Auth-Token'] = JUDGE0_KEY;
    }

    const payload = {
      language_id: spec.id, source_code: b64(code),
      stdin: b64(stdin.slice(0, MAX_STDIN_BYTES)),
      cpu_time_limit: 8, wall_time_limit: 12, memory_limit: 256000,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    let response;
    try {
      response = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`, {
        method: 'POST', headers: judgeHeaders, body: JSON.stringify(payload), signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      const msg = e.name === 'AbortError' ? 'The runner took too long to respond. Try again.' : 'Could not reach the code runner. It may be busy — try again in a moment.';
      return json({ error: msg, runnerDown: true }, 503);
    }
    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 429) return json({ error: 'The shared code runner is rate limiting right now. Please try again shortly.', runnerDown: true }, 503);
      console.error('judge0 error', response.status, text.slice(0, 300));
      return json({ error: 'The code runner returned an error. Please try again.', runnerDown: true }, 503);
    }

    const dRaw = await response.text();
    let d;
    try { d = JSON.parse(dRaw); } catch { return json({ error: 'The code runner sent an unreadable reply.', runnerDown: true }, 503); }

    return json({
      statusId: d.status?.id ?? 0, status: d.status?.description || 'Unknown',
      stdout: unb64(d.stdout), stderr: unb64(d.stderr),
      compileOutput: unb64(d.compile_output), message: d.message || '',
      time: d.time || null, memory: d.memory || null,
    });
  } catch (err) {
    return errorResponse(err, 'Could not run your code.');
  }
}
