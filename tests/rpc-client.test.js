import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createRpcClient } from '../server/data/rpc.js';
import { NETWORK } from '../server/config.js';

const txHash = `0x${'ab'.repeat(32)}`;
const from = `0x${'11'.repeat(20)}`;
const to = `0x${'22'.repeat(20)}`;
const topicAddress = (address) => `0x${'0'.repeat(24)}${address.slice(2)}`;
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function resultFor(method) {
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
  if (method === 'eth_getTransactionByHash') return { hash: txHash, blockNumber: '0x3e7', from, to: NETWORK.contract, value: '0x0' };
  if (method === 'eth_getTransactionReceipt') return { status: '0x1', logs: resultFor('eth_getLogs') };
  return null;
}

async function withRpcServer(run) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const payload = JSON.parse(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: resultFor(payload.method) }));
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); } finally { server.close(); await once(server, 'close'); }
}

test('RPC client reads live-format activity and transaction fixtures without precision loss', async () => {
  await withRpcServer(async (url) => {
    const client = createRpcClient({
      rpc: { url, lookbackBlocks: 1000, chunkBlocks: 1000, maxActivity: 10 },
      upstreamTimeoutMs: 3000,
    });
    const status = await client.status();
    assert.equal(status.available, true);
    assert.equal(status.chainId, 84532);

    const activity = await client.getRecentTransferLogs({ limit: 5 });
    assert.equal(activity.transfers.length, 1);
    assert.equal(activity.transfers[0].amount, '1');
    assert.equal(activity.transfers[0].from, from);

    const transaction = await client.getTransaction(txHash);
    assert.equal(transaction.status, 'success');
    assert.equal(transaction.tokenTransfers.length, 1);
  });
});
