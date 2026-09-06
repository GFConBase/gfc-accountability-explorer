export function truncateMiddle(value, head = 8, tail = 6) {
  const text = String(value || '');
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

export function formatDate(iso) {
  if (!iso) return 'Unavailable';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-US').format(number) : '—';
}

export function stateLabel(state) {
  return ({
    verified: 'Verified',
    partially_verifiable: 'Partially verifiable',
    not_verifiable: 'Not verifiable',
    unavailable: 'Unavailable',
  })[state] || 'Unavailable';
}

export function stateClass(state) {
  return ({
    verified: 'state-verified',
    partially_verifiable: 'state-partial',
    not_verifiable: 'state-unverified',
    unavailable: 'state-unavailable',
  })[state] || 'state-unavailable';
}
