const cache = new Map();
const pending = new Map();

export async function withCache(key, ttlMs, loader) {
  const now = Date.now();
  const current = cache.get(key);
  if (current && current.expiresAt > now) return current.value;
  if (pending.has(key)) return pending.get(key);

  const request = Promise.resolve()
    .then(loader)
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}

export function clearCache() {
  cache.clear();
  pending.clear();
}
