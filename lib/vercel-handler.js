/**
 * Shared adapters for the Vercel API.
 *
 * The real route logic lives in `functions/api/*` (Cloudflare Pages Functions
 * format: onRequestGet / onRequestPost(context)). These adapters turn Vercel's
 * Node-style (req, res) into that (context) shape by building a Web `Request`
 * from the incoming Node request and passing `process.env` as the env, then
 * copying the returned `Response` back to Vercel's res. One source of truth,
 * two platforms.
 *
 * - `makeHandler(mod)` wraps a single Cloudflare module (used by per-route
 *   files such as `api/auth/me.js`).
 * - `makeRouter(routes)` dispatches a path/segments table to Cloudflare
 *   modules (used by the `api/[...path].js` catch-all).
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-Key',
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

/** Build the Web Request + context shared by both adapters. */
async function buildRequest(req, method) {
  const headers = { ...req.headers };
  if (!headers['cf-connecting-ip'] && req.headers['x-forwarded-for']) {
    headers['cf-connecting-ip'] = String(req.headers['x-forwarded-for']).split(',')[0].trim();
  }
  // Let the Web Request derive these itself; a stale content-length would break the body.
  delete headers['content-length'];
  delete headers['transfer-encoding'];

  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readBody(req) : undefined;
  const request = new Request(new URL(req.url || '/', 'https://nought.local').toString(), { method, headers, body });
  return { request, env: process.env };
}

/** Wrap a single Cloudflare Pages Function module as a Vercel (req, res) handler. */
export function makeHandler(mod) {
  return async function handler(req, res) {
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    if (req.method === 'OPTIONS') return res.status(204).end();

    const method = (req.method || 'GET').toUpperCase();
    const fn = mod[methodFn(method)];
    if (typeof fn !== 'function') return sendJson(res, 405, { error: 'Method not allowed' });

    try {
      const response = await fn(await buildRequest(req, method));
      return writeResponse(res, response);
    } catch (err) {
      console.error('API error:', err);
      return sendJson(res, 500, { error: 'Something went wrong.' });
    }
  };
}

/**
 * Dispatch a `METHOD path` route table (e.g. `{ 'GET me': meModule, ... }`) to
 * Cloudflare modules, resolving the path from the request URL.
 */
export function makeRouter(routes) {
  return async function handler(req, res) {
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    if (req.method === 'OPTIONS') return res.status(204).end();

    const method = (req.method || 'GET').toUpperCase();
    const url = new URL(req.url || '/', 'https://nought.local');
    const path = url.pathname.replace(/^\/api\/?/, '');
    const segments = path.split('/').filter(Boolean);
    const mod = routes[`${method} ${segments.join('/')}`];
    if (!mod) return sendJson(res, 404, { error: 'Not found' });

    const fn = mod[methodFn(method)];
    if (typeof fn !== 'function') return sendJson(res, 405, { error: 'Method not allowed' });

    try {
      const response = await fn(await buildRequest(req, method));
      return writeResponse(res, response);
    } catch (err) {
      console.error('API error:', err);
      return sendJson(res, 500, { error: 'Something went wrong.' });
    }
  };
}
