/**
 * Vercel catch-all API handler.
 *
 * The real route logic lives in `functions/api/*` (Cloudflare Pages Functions
 * format: onRequestGet / onRequestPost(context)). This handler adapts Vercel's
 * Node-style (req, res) into that (context) shape by building a Web `Request`
 * from the incoming Node request and passing `process.env` as the env, then
 * copying the returned `Response` back to Vercel's res. One source of truth,
 * two platforms.
 */
import * as languages from '../functions/api/languages.js';
import * as curriculum from '../functions/api/curriculum.js';
import * as lesson from '../functions/api/lesson.js';
import * as progress from '../functions/api/progress.js';
import * as me from '../functions/api/me.js';
import * as run from '../functions/api/run.js';
import * as stats from '../functions/api/stats.js';
import * as submissions from '../functions/api/submissions.js';
import * as leaderboard from '../functions/api/leaderboard.js';
import * as authMe from '../functions/api/auth/me.js';
import * as signup from '../functions/api/auth/signup.js';
import * as login from '../functions/api/auth/login.js';
import * as verifyOtp from '../functions/api/auth/verify-otp.js';
import * as resendOtp from '../functions/api/auth/resend-otp.js';
import * as forgotPassword from '../functions/api/auth/forgot-password.js';
import * as changePassword from '../functions/api/auth/change-password.js';
import * as deleteAccount from '../functions/api/auth/delete-account.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-Key',
};

const ROUTES = {
  'GET languages': languages,
  'GET curriculum': curriculum,
  'GET lesson': lesson,
  'GET progress': progress,
  'POST progress': progress,
  'GET me': me,
  'POST run': run,
  'GET stats': stats,
  'GET submissions': submissions,
  'GET leaderboard': leaderboard,
  'GET auth/me': authMe,
  'POST auth/signup': signup,
  'POST auth/login': login,
  'POST auth/verify-otp': verifyOtp,
  'POST auth/resend-otp': resendOtp,
  'POST auth/forgot-password': forgotPassword,
  'POST auth/change-password': changePassword,
  'POST auth/delete-account': deleteAccount,
};

const methodFn = (m) => `onRequest${m.charAt(0) + m.slice(1).toLowerCase()}`;

/** Read the request body. Prefers a pre-parsed req.body (dev server), else reads the stream. */
async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(data));
}

async function writeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    try { res.setHeader(key, value); } catch { /* ignore hop-by-hop headers */ }
  });
  return res.end(await response.text());
}

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'https://nought.local');
  const path = url.pathname.replace(/^\/api\/?/, '');
  const segments = path.split('/').filter(Boolean);
  const mod = ROUTES[`${method} ${segments.join('/')}`];
  if (!mod) return sendJson(res, 404, { error: 'Not found' });

  const fn = mod[methodFn(method)];
  if (typeof fn !== 'function') return sendJson(res, 405, { error: 'Method not allowed' });

  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readBody(req) : undefined;

  // Best-effort client IP so rate limiting works on Vercel too.
  const headers = { ...req.headers };
  if (!headers['cf-connecting-ip'] && req.headers['x-forwarded-for']) {
    headers['cf-connecting-ip'] = String(req.headers['x-forwarded-for']).split(',')[0].trim();
  }
  // Let the Web Request derive these itself; a stale content-length would break the body.
  delete headers['content-length'];
  delete headers['transfer-encoding'];

  const request = new Request(url.toString(), { method, headers, body });
  const context = { request, env: process.env };

  try {
    const response = await fn(context);
    return writeResponse(res, response);
  } catch (err) {
    console.error('API error:', err);
    return sendJson(res, 500, { error: 'Something went wrong.' });
  }
}
