// ============================================================
// EARN — Cache + fetch helpers (server-side only)
// ============================================================
// - cache TTL configurable por clave
// - request deduplication (misma key en paralelo = misma promesa)
// - fetchWithTimeout: aborta y lanza error tipado
// - retryWithBackoff: reintento con backoff exponencial
// ============================================================

type CacheEntry<T> = { data: T; expires: number };
const cache = new Map<string, CacheEntry<any>>();
const inflight = new Map<string, Promise<any>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

export function clearCached(prefix?: string): void {
  if (!prefix) { cache.clear(); return; }
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

/**
 * Deduplication: si hay una promesa en vuelo con la misma clave,
 * devuelve la misma promesa en vez de disparar otra petición.
 */
export async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export class TimeoutError extends Error {
  constructor(public url: string, public ms: number) {
    super(`Timeout ${ms}ms: ${url}`);
    this.name = "TimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  ms = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; CriptoMy/1.0)",
        ...(opts.headers || {}),
      },
    });
    return res;
  } catch (err: any) {
    if (err?.name === "AbortError") throw new TimeoutError(url, ms);
    throw err;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  opts: RequestInit = {},
  ms = 8000,
): Promise<T> {
  const res = await fetchWithTimeout(url, opts, ms);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  }
  return (await res.json()) as T;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseMs = 300,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === retries) break;
      await new Promise(r => setTimeout(r, baseMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  return `hace ${Math.floor(s / 3600)}h`;
}
