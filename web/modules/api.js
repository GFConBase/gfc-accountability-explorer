async function request(path) {
  const response = await fetch(path, { headers: { accept: 'application/json' } });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Request failed with HTTP ${response.status}.`);
    error.code = payload?.error?.code || 'REQUEST_FAILED';
    throw error;
  }
  return payload;
}

export const api = Object.freeze({
  status: () => request('/api/status'),
  activity: ({ address = null, limit = 25 } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (address) params.set('address', address);
    return request(`/api/activity?${params.toString()}`);
  },
  transaction: (hash) => request(`/api/transaction/${encodeURIComponent(hash)}`),
});
