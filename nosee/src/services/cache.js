const cache = new Map();
const pendingCache = new Map();
const MAX_ENTRIES = 50;

const clone = typeof structuredClone !== 'undefined'
  ? structuredClone
  : (data) => JSON.parse(JSON.stringify(data));

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data, ttlMs = 120000) {
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, {
    data: clone(data),
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearCache(pattern) {
  if (!pattern) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

export function getOrSetCache(key, fetchFn, ttlMs = 120000) {
  const cached = getCached(key);
  if (cached) return Promise.resolve(cached);

  if (pendingCache.has(key)) {
    return pendingCache.get(key);
  }

  const promise = fetchFn().then(data => {
    setCache(key, data, ttlMs);
    pendingCache.delete(key);
    return data;
  }).catch(err => {
    pendingCache.delete(key);
    throw err;
  });

  pendingCache.set(key, promise);
  return promise;
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) cache.delete(key);
    }
  }, 300000);
}
