import { applyCors, resolveIdentity, sendError } from './_auth.js';
import { checkRunLimit, clientIp } from './_ratelimit.js';

/**
 * Code execution.
 *
 * Defaults to the public Judge0 CE endpoint, which is unauthenticated and
 * shared. Set JUDGE0_URL (and JUDGE0_KEY, or JUDGE0_RAPIDAPI_HOST + key) to
 * point at a private or self-hosted instance with no shared quota.
 */

const JUDGE0_URL = (process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/+$/, '');
const JUDGE0_KEY = process.env.JUDGE0_KEY || '';
const RAPIDAPI_HOST = process.env.JUDGE0_RAPIDAPI_HOST || '';

const LANGS = {
  python: { id: 100, file: 'main.py' },
  c: { id: 103, file: 'main.c' },
  cpp: { id: 105, file: 'main.cpp' },
  java: { id: 91, file: 'Main.java' },
  rust: { id: 108, file: 'main.rs' },
};

const MAX_CODE_BYTES = 40_000;
const MAX_STDIN_BYTES = 8_000;

const b64 = (s) => Buffer.from(s ?? '', 'utf8').toString('base64');
const unb64 = (s) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');

function judgeHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (JUDGE0_KEY && RAPIDAPI_HOST) {
    h['X-RapidAPI-Key'] = JUDGE0_KEY;
    h['X-RapidAPI-Host'] = RAPIDAPI_HOST;
  } else if (JUDGE0_KEY) {
    h['X-Auth-Token'] = JUDGE0_KEY;
  }
  return h;
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const identity = await resolveIdentity(req);
    const ip = clientIp(req);
    const limitKey = identity?.userKey || `ip_${ip}`;

    const gate = await checkRunLimit(limitKey, ip);
    if (!gate.ok) {
      res.setHeader('Retry-After', String(gate.retryAfter || 30));
      return res.status(gate.status).json({ error: gate.message, rateLimited: true });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const language = String(body.language || '');
    const code = String(body.code ?? '');
    const stdin = String(body.stdin ?? '');

    const spec = LANGS[language];
    if (!spec) {
      return res.status(400).json({ error: `Unsupported language: ${language || '(none)'}` });
    }
    if (!code.trim()) {
      return res.status(400).json({ error: 'There is no code to run yet.' });
    }
    if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
      return res.status(413).json({ error: 'That program is too large to run here.' });
    }

    const payload = {
      language_id: spec.id,
      source_code: b64(code),
      stdin: b64(stdin.slice(0, MAX_STDIN_BYTES)),
      cpu_time_limit: 8,
      wall_time_limit: 12,
      memory_limit: 256000,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);

    let response;
    try {
      response = await fetch(
        `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`,
        {
          method: 'POST',
          headers: judgeHeaders(),
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );
    } catch (e) {
      clearTimeout(timer);
      const msg =
        e.name === 'AbortError'
          ? 'The runner took too long to respond. Try again.'
          : 'Could not reach the code runner. It may be busy — try again in a moment.';
      return res.status(503).json({ error: msg, runnerDown: true });
    }
    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 429) {
        return res.status(503).json({
          error: 'The shared code runner is rate limiting right now. Please try again shortly.',
          runnerDown: true,
        });
      }
      console.error('judge0 error', response.status, text.slice(0, 300));
      return res.status(503).json({
        error: 'The code runner returned an error. Please try again.',
        runnerDown: true,
      });
    }

    const dRaw = await response.text();
    let d;
    try {
      d = JSON.parse(dRaw);
    } catch {
      return res.status(503).json({ error: 'The code runner sent an unreadable reply.', runnerDown: true });
    }

    return res.status(200).json({
      statusId: d.status?.id ?? 0,
      status: d.status?.description || 'Unknown',
      stdout: unb64(d.stdout),
      stderr: unb64(d.stderr),
      compileOutput: unb64(d.compile_output),
      message: d.message || '',
      time: d.time || null,
      memory: d.memory || null,
    });
  } catch (err) {
    return sendError(res, err, 'Could not run your code.');
  }
}
