import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, parseSearchTarget, safeErrorPayload } from '../../lib/explorer/http.js';

test('search parsing accepts only address or transaction hash', () => {
  assert.equal(parseSearchTarget(`0x${'11'.repeat(20)}`).type, 'address');
  assert.equal(parseSearchTarget(`0x${'22'.repeat(32)}`).type, 'transaction');
  assert.equal(parseSearchTarget('<script>alert(1)</script>'), null);
  assert.equal(parseSearchTarget('x'.repeat(100)), null);
});

test('production error payload does not expose arbitrary upstream details', () => {
  const payload = safeErrorPayload(Object.assign(new Error('secret internal stack data'), { code: 'SOMETHING_ELSE' }));
  assert.equal(payload.error.message, 'The request could not be completed.');
  assert.doesNotMatch(JSON.stringify(payload), /secret internal/u);
});

test('rate limiter blocks requests over the configured window maximum', () => {
  const allow = createRateLimiter({ max: 2, windowMs: 60_000 });
  assert.equal(allow('test'), true);
  assert.equal(allow('test'), true);
  assert.equal(allow('test'), false);
});
