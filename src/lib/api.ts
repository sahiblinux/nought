import supabase from './supabase';

/**
 * API base URL. Empty string means same-origin (Vercel / Cloudflare Pages).
 * Set VITE_API_BASE in .env for split deployments (e.g. GitHub Pages
 * frontend + Vercel API). No trailing slash.
 */
const API_BASE = (import.meta.env.VITE_API_BASE as string) || '';

const GUEST_KEY = 'nought:guest-key';

/** Stable per-browser guest identity. Namespaced so it can never collide with
 *  a Supabase auth uuid on the server. */
export function guestKey(): string {
  let k = localStorage.getItem(GUEST_KEY);
  if (!k || !/^guest_[a-z0-9]{6,32}$/.test(k)) {
    k = `guest_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
    localStorage.setItem(GUEST_KEY, k);
  }
  return k;
}

/** Auth headers: a verified bearer token when signed in, otherwise the guest key. */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    /* fall through to guest */
  }
  return { 'X-Guest-Key': guestKey() };
}

export class ApiError extends Error {
  status: number;
  rateLimited: boolean;
  runnerDown: boolean;

  constructor(message: string, status: number, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.rateLimited = !!extra?.rateLimited;
    this.runnerDown = !!extra?.runnerDown;
  }
}

async function request<T>(url: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (auth) Object.assign(headers, await authHeaders());

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();

  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const rec = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const msg =
      typeof rec.error === 'string' && rec.error
        ? rec.error
        : res.status === 401
          ? 'Your session has expired. Please sign in again.'
          : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, rec);
  }

  return body as T;
}

/** Authenticated GET (or any verb via init). */
export const api = <T>(url: string, init?: RequestInit) => request<T>(`${API_BASE}${url}`, init, true);

/** Public GET for content that needs no identity (languages, curriculum, lessons). */
export const publicApi = <T>(url: string) => request<T>(`${API_BASE}${url}`, {}, false);

export const postJson = <T>(url: string, data: unknown) =>
  request<T>(
    `${API_BASE}${url}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    true
  );
