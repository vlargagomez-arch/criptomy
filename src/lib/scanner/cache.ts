// ============================================================
// CACHE CON TTL + CIRCUIT BREAKER
// ============================================================
// Cache en memoria (server-side) para no golpear APIs innecesariamente.
// Circuit Breaker para no seguir golpeando un provider caído.
// ============================================================

import type { ProviderStatus } from "./types";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  cachedAt: number;
}

// LRU cache simple con TTL por entrada
const cache = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    cachedAt: Date.now(),
  });
}

export function cacheClear(): void {
  cache.clear();
}

// ============================================================
// Circuit Breaker — si un provider falla N veces seguidas,
// lo marcamos como "open" por un tiempo y no lo llamamos.
// ============================================================

interface BreakerState {
  failures: number;
  openUntil: number;
}

const breakers = new Map<string, BreakerState>();
const FAILURE_THRESHOLD = 3;
const OPEN_DURATION_MS = 60_000; // 1 min

export function isCircuitOpen(provider: string): boolean {
  const state = breakers.get(provider);
  if (!state) return false;
  if (state.openUntil > Date.now()) return true;
  if (state.openUntil > 0 && state.openUntil <= Date.now()) {
    // half-open: reset para reintentar
    state.openUntil = 0;
    state.failures = 0;
  }
  return false;
}

export function recordFailure(provider: string): void {
  const state = breakers.get(provider) || { failures: 0, openUntil: 0 };
  state.failures += 1;
  if (state.failures >= FAILURE_THRESHOLD) {
    state.openUntil = Date.now() + OPEN_DURATION_MS;
    console.warn(`[circuit] ${provider} OPEN por ${OPEN_DURATION_MS / 1000}s (${state.failures} fallos)`);
  }
  breakers.set(provider, state);
}

export function recordSuccess(provider: string): void {
  breakers.delete(provider);
}

export function getBreakerState(provider: string): { failures: number; open: boolean } {
  const state = breakers.get(provider);
  return {
    failures: state?.failures || 0,
    open: state ? state.openUntil > Date.now() : false,
  };
}

// ============================================================
// Helper: fetch con timeout + cache + circuit breaker
// ============================================================

export async function fetchWithCache<T>(
  url: string,
  opts: {
    provider: string;
    ttlMs?: number;            // default 15s
    timeoutMs?: number;        // default 8s
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    cacheKey?: string;
  }
): Promise<{ data: T | null; latencyMs: number; status: ProviderStatus; error?: string }> {
  const provider = opts.provider;
  const cacheKey = opts.cacheKey || url;
  const ttlMs = opts.ttlMs ?? 15_000;
  const timeoutMs = opts.timeoutMs ?? 8000;

  // 1) Circuit breaker check
  if (isCircuitOpen(provider)) {
    return {
      data: null,
      latencyMs: 0,
      status: "DISABLED",
      error: `Circuit open para ${provider} (provider marcado como caído temporalmente)`,
    };
  }

  // 2) Cache check
  const cached = cacheGet<T>(cacheKey);
  if (cached) {
    return { data: cached, latencyMs: 0, status: "ONLINE" };
  }

  // 3) Fetch con timeout
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: opts.method || "GET",
      body: opts.body,
      headers: opts.headers || { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - start;

    if (res.status === 429) {
      recordFailure(provider);
      return { data: null, latencyMs, status: "RATE_LIMITED", error: "Rate limited (429)" };
    }

    if (!res.ok) {
      recordFailure(provider);
      return { data: null, latencyMs, status: "ERROR", error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as T;
    cacheSet(cacheKey, data, ttlMs);
    recordSuccess(provider);
    return { data, latencyMs, status: "ONLINE" };
  } catch (err) {
    const latencyMs = Date.now() - start;
    recordFailure(provider);
    return {
      data: null,
      latencyMs,
      status: "ERROR",
      error: (err as Error).message,
    };
  }
}
