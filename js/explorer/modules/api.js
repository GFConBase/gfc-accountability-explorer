const API_BASE = '/api/explorer';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
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
  meta: () => request('/meta'),
  status: () => request('/status'),
  activity: ({ address = null, limit = 25 } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (address) params.set('address', address);
    return request(`/activity?${params.toString()}`);
  },
  transaction: (hash) => request(`/transaction/${encodeURIComponent(hash)}`),
  address: (address) => request(`/address/${encodeURIComponent(address)}`),
  references: () => request('/gfc/references'),
  reference: (value) => request(`/gfc/reference/${encodeURIComponent(value)}`),
  snapshot: () => request('/gfc/snapshot'),
  analyst: ({ question, scope = 'recent', target = null, locale = 'en' }) => request('/analyst', {
    method: 'POST',
    body: { question, scope, target, locale },
  }),
});
