import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createBlockscoutClient } from '../../lib/explorer/data/blockscout.js';
import { NETWORK } from '../../lib/explorer/config.js';

const txHash = `0x${'ab'.repeat(32)}`;
const from = `0x${'11'.repeat(20)}`;
const to = `0x${'22'.repeat(20)}`;

function transactionFixture() {
  return {
    hash: txHash,
    timestamp: '2026-07-28T12:00:00.000Z',
    block_number: 44000000,
    status: 'ok',
    from: { hash: from },
    to: { hash: NETWORK.contract },
    value: '0',
    token_transfers: [{
      transaction_hash: txHash,
      block_number: 44000000,
      log_index: '4',
      timestamp: '2026-07-28T12:00:00.000Z',
      from: { hash: from },
      to: { hash: to },
      token: {
        address_hash: NETWORK.contract,
        type: 'ERC-20',
        decimals: '18',
        symbol: 'tGFC',
      },
      total: { value: '1000000000000000000', decimals: '18' },
    }],
  };
}

test('Blockscout fallback normalizes historical transaction and tGFC transfer evidence', async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, `/transactions/${txHash}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(transactionFixture()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const client = createBlockscoutClient({
      blockscout: { apiUrl: `http://127.0.0.1:${server.address().port}` },
      upstreamTimeoutMs: 3000,
    });
    const result = await client.getTransaction(txHash);
    assert.equal(result.transactionHash, txHash);
    assert.equal(result.status, 'success');
    assert.equal(result.receiptAvailable, false);
    assert.equal(result.executionEvidenceKind, 'indexed_transaction');
    assert.equal(result.tokenTransfers.length, 1);
    assert.equal(result.tokenTransfers[0].amount, '1');
    assert.equal(result.tokenTransfers[0].contract, NETWORK.contract);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
