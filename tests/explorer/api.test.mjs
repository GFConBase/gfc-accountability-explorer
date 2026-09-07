import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiHandler } from '../../lib/explorer/api.js';

const hash = `0x${'ab'.repeat(32)}`;

function params(values = {}) {
  return new URLSearchParams(values);
}

test('platform-neutral API handler returns a clean 404 for a valid but unknown Base Sepolia transaction', async () => {
  const provider = {
    status: async () => ({ available: true }),
    activity: async () => ({ transfers: [] }),
    transaction: async () => null,
  };
  const handle = createApiHandler(provider);
  const result = await handle({
    method: 'GET',
    pathname: `/api/transaction/${hash}`,
    searchParams: params(),
    clientKey: 'test',
  });
  assert.equal(result.statusCode, 404);
  assert.equal(result.payload.error.code, 'TRANSACTION_NOT_FOUND');
});

test('platform-neutral API handler preserves input validation', async () => {
  const provider = {
    status: async () => ({ available: true }),
    activity: async () => ({ transfers: [] }),
    transaction: async () => null,
  };
  const handle = createApiHandler(provider);
  const result = await handle({
    method: 'GET',
    pathname: '/api/activity',
    searchParams: params({ address: 'not-an-address' }),
    clientKey: 'test',
  });
  assert.equal(result.statusCode, 400);
  assert.equal(result.payload.error.code, 'INVALID_ADDRESS');
});
