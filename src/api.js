/**
 * API layer with a localStorage cache.
 *
 * The signal server runs a collector that refreshes data every few minutes;
 * caching responses on the browser keeps the frontend snappy and avoids
 * hammering the backend when the page reloads.
 */

// Backend origin. VITE_API (build-time env) can override this; the deployed
// default below is the live Vercel API so the site works with no repo vars.
const API_BASE = import.meta.env.VITE_API || "https://market-sig-server.vercel.app";

const CACHE_TTL = {
  overview: 60_000,
  index: 60_000,
  item: 60_000,
  feed: 20_000,
  meta: 60_000,
};

const CACHE_PREFIX = "msig:";

function cacheKey(name, params) {
  return CACHE_PREFIX + name + ":" + JSON.stringify(params || {});
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > 24 * 3600_000) return null; // hard expiry 24h
    return data;
  } catch {
    return null;
  }
}

function cacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* storage full — ignore */
  }
}

async function fetchJson(path, params, { ttl = 0, force = false } = {}) {
  const key = cacheKey(path, params);
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  if (!force) {
    const cached = cacheGet(key);
    if (cached != null && Date.now() - cached.t <= ttl) return cached.data;
    if (cached != null) return cached.data; // stale-but-present fallback
  }

  const res = await fetch(`${API_BASE}${path}${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  const data = await res.json();
  cacheSet(key, { t: Date.now(), data });
  return data;
}

export const api = {
  async meta(force = false) {
    return fetchJson("/api/meta", null, { ttl: CACHE_TTL.meta, force });
  },

  async overview(force = false) {
    return fetchJson("/api/overview", null, { ttl: CACHE_TTL.overview, force });
  },

  async indexHistory(force = false) {
    return fetchJson("/api/index/history", null, { ttl: CACHE_TTL.index, force });
  },

  async item(code, force = false) {
    return fetchJson(`/api/item/${encodeURIComponent(code)}`, null, { ttl: CACHE_TTL.item, force });
  },

  async feed(limit = 60, force = false) {
    return fetchJson("/api/feed/latest", { limit }, { ttl: CACHE_TTL.feed, force });
  },
};

export function clearCache() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
