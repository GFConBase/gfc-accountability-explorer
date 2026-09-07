export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export function hexToBigInt(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/u.test(value)) {
    throw new TypeError('Expected a hexadecimal quantity.');
  }
  return BigInt(value);
}

export function hexToNumber(value) {
  const number = Number(hexToBigInt(value));
  if (!Number.isSafeInteger(number)) throw new RangeError('Hex quantity exceeds safe integer range.');
  return number;
}

export function bigintToHex(value) {
  return `0x${BigInt(value).toString(16)}`;
}

export function topicToAddress(topic) {
  if (typeof topic !== 'string' || !/^0x[0-9a-fA-F]{64}$/u.test(topic)) {
    throw new TypeError('Invalid indexed address topic.');
  }
  return `0x${topic.slice(-40)}`.toLowerCase();
}

export function formatTokenAmount(baseUnits, decimals = 18) {
  const value = BigInt(baseUnits);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const divisor = 10n ** BigInt(decimals);
  const whole = absolute / divisor;
  const fraction = absolute % divisor;
  const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/u, '');
  return `${negative ? '-' : ''}${whole.toString()}${fractionText ? `.${fractionText}` : ''}`;
}

export function safeIsoFromUnix(seconds) {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  const date = new Date(numeric * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
