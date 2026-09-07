export const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/u;
export const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/u;

export function isAddress(value) {
  return typeof value === 'string' && ADDRESS_RE.test(value);
}

export function isTxHash(value) {
  return typeof value === 'string' && TX_HASH_RE.test(value);
}

export function normalizeAddress(value) {
  if (!isAddress(value)) throw new TypeError('Invalid Ethereum address.');
  return value.toLowerCase();
}

export function normalizeTxHash(value) {
  if (!isTxHash(value)) throw new TypeError('Invalid transaction hash.');
  return value.toLowerCase();
}

export function boundedLimit(value, fallback = 25, max = 50) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new TypeError(`limit must be between 1 and ${max}.`);
  }
  return parsed;
}
