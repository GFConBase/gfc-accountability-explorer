const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/u;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/u;

export function classifySearch(value) {
  const trimmed = String(value || '').trim();
  if (ADDRESS_RE.test(trimmed)) return { type: 'address', value: trimmed.toLowerCase() };
  if (TX_HASH_RE.test(trimmed)) return { type: 'transaction', value: trimmed.toLowerCase() };
  return null;
}
