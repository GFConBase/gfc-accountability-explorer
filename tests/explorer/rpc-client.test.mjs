import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createRpcClient } from '../../lib/explorer/data/rpc.js';
import { NETWORK } from '../../lib/explorer/config.js';

const txHash = `0x${'ab'.repeat(32)}`;
const unknownTxHash = `0x${'cd'.repeat(32)}`;
const from = `0x${'11'.repeat(20)}`;
const to = `0x${'22'.repeat(20)}`;
const topicAddress = (address) => `0x${'0'.repeat(24)}${address.slice(2)}`;
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function resultFor(method, params = []) {
  if (method === 'eth_chainId') return '0x14a34';
  if (method === 'eth_blockNumber') return '0x3e8';
  if (method === 'eth_getBlockByNumber') return { timestamp: '0x68bd8e00' };
  if (method === 'eth_getLogs') return [{
    address: NETWORK.contract,
    topics: [transferTopic, topicAddress(from), topicAddress(to)],
    data: '0xde0b6b3a7640000',
    blockNumber: '0x3e7',
    logIndex: '0x0',
    transactionHash: txHash,
  }];
  if (method === 'eth_getTransactionByHash') {
    if (params[0] === unknownTxHash) return null;
    return { hash: txHash, blockNumber: '0x3e7', from, to: NETWORK.contract, value: '0x0' };
  }
  if (method === 'eth_getTransactionReceipt') {
    if (params[0] === unknownTxHash) return null;
    return { status: '0x1', logs: resultFor('eth_getLogs') };
  }
  return null;
}

async function startRpcServer(handler = null) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const payload = JSON.parse(body);
      if (handler) return handler({ req, res, payload });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: resultFor(payload.method, payload.params) }));
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      server.close();
      await once(server, 'close');
    },
  };
}

function rpcConfig(urls) {
  return {
    rpc: { urls, url: urls[0], lookbackBlocks: 1000, chunkBlocks: 1000, maxActivity: 10 },
    upstreamTimeoutMs: 3000,
  };
}

test('RPC client reads live-format activity and transaction fixtures without precision loss', async () => {
  const rpc = await startRpcServer();
  try {
    const client = createRpcClient(rpcConfig([rpc.url]));
    const status = await client.status();
    assert.equal(status.available, true);
    assert.equal(status.chainId, 84532);

    const activity = await client.getRecentTransferLogs({ limit: 5 });
    assert.equal(activity.transfers.length, 1);
    assert.equal(activity.transfers[0].amount, '1');
    assert.equal(activity.transfers[0].from, from);

    const transaction = await client.getTransaction(txHash);
    assert.equal(transaction.status, 'success');
    assert.equal(transaction.receiptAvailable, true);
    assert.equal(transaction.tokenTransfers.length, 1);
  } finally {
    await rpc.close();
  }
});

test('transaction lookup returns not-found cleanly when a reachable Base Sepolia endpoint returns null', async () => {
  const rpc = await startRpcServer();
  try {
    const client = createRpcClient(rpcConfig([rpc.url]));
    assert.equal(await client.getTransaction(unknownTxHash), null);
  } finally {
    await rpc.close();
  }
});

test('RPC client fails over from an unavailable endpoint to a working Base Sepolia endpoint', async () => {
  const failing = await startRpcServer(({ res }) => {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'temporary failure' }));
  });
  const working = await startRpcServer();

  try {
    const client = createRpcClient(rpcConfig([failing.url, working.url]));
    const status = await client.status();
    assert.equal(status.available, true);
    assert.equal(status.configuredEndpoints, 2);

    const transaction = await client.getTransaction(txHash);
    assert.equal(transaction.transactionHash, txHash);
    assert.equal(transaction.status, 'success');
  } finally {
    await failing.close();
    await working.close();
  }
});

test('RPC client ignores a wrong-chain endpoint when another configured endpoint is Base Sepolia', async () => {
  const wrong = await startRpcServer(({ res, payload }) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    const result = payload.method === 'eth_chainId' ? '0x1' : resultFor(payload.method, payload.params);
    res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });
  const working = await startRpcServer();

  try {
    const client = createRpcClient(rpcConfig([wrong.url, working.url]));
    const status = await client.status();
    assert.equal(status.available, true);
    assert.equal(status.chainId, 84532);
  } finally {
    await wrong.close();
    await working.close();
  }
});
