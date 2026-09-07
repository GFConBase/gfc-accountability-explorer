import { getLocale, t } from './i18n.js';

export function truncateMiddle(value, head = 8, tail = 6) {
  const text = String(value || '');
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

export function formatDate(iso) {
  if (!iso) return t('unavailable');
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t('unavailable');
  return new Intl.DateTimeFormat(getLocale() === 'de' ? 'de-DE' : 'en-US', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat(getLocale() === 'de' ? 'de-DE' : 'en-US').format(number) : '—';
}

export function stateLabel(state) {
  return ({
    verified: t('verified'),
    partially_verifiable: t('partial'),
    not_verifiable: t('notVerifiable'),
    unavailable: t('unavailable'),
  })[state] || t('unavailable');
}

export function stateClass(state) {
  return ({
    verified: 'state-verified',
    partially_verifiable: 'state-partial',
    not_verifiable: 'state-unverified',
    unavailable: 'state-unavailable',
  })[state] || 'state-unavailable';
}
