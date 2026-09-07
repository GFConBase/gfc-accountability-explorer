import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createDataProvider } from '../../lib/explorer/data/provider.js';
import { NETWORK } from '../../lib/explorer/config.js';

const txHash = `0x${'aa'.repeat(32)}`;
const from = `0x${'11'.repeat(20)}`;
const to = `0x${'22'.repeat(20)}`;
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const topicAddress = (address) => `0x${'0'.repeat(24)}${address.slice(2)}`;

test('searching the tGFC contract switches to contract-event scope instead of filtering from/to', async () => {
  const seenFilters = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const payload = JSON.parse(body);
      let result = null;
      if (payload.method === 'eth_chainId') result = '0x14a34';
      if (payload.method === 'eth_blockNumber') result = '0x3e8';
      if (payload.method === 'eth_getBlockByNumber') result = { timestamp: '0x68bd8e00' };
      if (payload.method === 'eth_getLogs') {
        seenFilters.push(payload.params[0]);
        result = [{
          address: NETWORK.contract,
          topics: [transferTopic, topicAddress(from), topicAddress(to)],
          data: '0x1',
          blockNumber: '0x3e7',
          logIndex: '0x0',
          transactionHash: txHash,
        }];
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;

  try {
    const provider = createDataProvider({
      mode: 'rpc',
      graph: { configured: false },
      rpc: { urls: [url], url, lookbackBlocks: 1000, chunkBlocks: 1000, maxActivity: 10 },
      upstreamTimeoutMs: 3000,
    });

    const result = await provider.activity({ address: NETWORK.contract, limit: 5 });
    assert.equal(result.queryScope, 'token_contract');
    assert.equal(result.transfers.length, 1);
    assert.equal(seenFilters.length, 1);
    assert.deepEqual(seenFilters[0].topics, [transferTopic]);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('transaction lookup falls back to Base Sepolia Blockscout when RPC cannot serve historical transaction', async () => {
  const rpcServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const payload = JSON.parse(body);
      if (payload.method === 'eth_chainId') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: '0x14a34' }));
        return;
      }
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'historical lookup unavailable' }));
    });
  });
  rpcServer.listen(0, '127.0.0.1');
  await once(rpcServer, 'listening');

  const blockscoutServer = http.createServer((req, res) => {
    assert.equal(req.url, `/transactions/${txHash}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
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
        log_index: 1,
        timestamp: '2026-07-28T12:00:00.000Z',
        from: { hash: from },
        to: { hash: to },
        token: {
          address_hash: NETWORK.contract,
          type: 'ERC-20',
          decimals: '18',
          symbol: 'tGFC',
        },
        total: { value: '2000000000000000000', decimals: '18' },
      }],
    }));
  });
  blockscoutServer.listen(0, '127.0.0.1');
  await once(blockscoutServer, 'listening');

  try {
    const rpcUrl = `http://127.0.0.1:${rpcServer.address().port}`;
    const provider = createDataProvider({
      mode: 'auto',
      graph: { configured: false },
      blockscout: { apiUrl: `http://127.0.0.1:${blockscoutServer.address().port}` },
      rpc: { urls: [rpcUrl], url: rpcUrl, lookbackBlocks: 1000, chunkBlocks: 1000, maxActivity: 10 },
      upstreamTimeoutMs: 3000,
    });

    const result = await provider.transaction(txHash);
    assert.equal(result.source, 'base_blockscout');
    assert.equal(result.sourceMode, 'historical_fallback');
    assert.match(result.warning, /RPC could not serve this transaction lookup/u);
    assert.equal(result.transaction.status, 'success');
    assert.equal(result.transaction.tokenTransfers.length, 1);
    assert.equal(result.accountability.funds.status, 'verified');
    assert.match(result.accountability.outcomes.summary, /indexed transaction execution record/u);
  } finally {
    rpcServer.close();
    blockscoutServer.close();
    await Promise.all([once(rpcServer, 'close'), once(blockscoutServer, 'close')]);
  }
});
