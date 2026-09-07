import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../../netlify/functions/explorer-api.mjs';

test('Netlify adapter serves metadata without contacting an external provider', async () => {
  const result = await handler({
    httpMethod: 'GET',
    queryStringParameters: { route: 'meta' },
    headers: {},
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.headers['content-type'], /application\/json/u);
  assert.equal(result.headers['x-frame-options'], 'DENY');

  const body = JSON.parse(result.body);
  assert.equal(body.network, 'Base Sepolia');
  assert.equal(body.chainId, 84532);
  assert.equal(body.readOnly, true);
});
