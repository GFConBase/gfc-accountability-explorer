import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from '../../lib/explorer/api.js';
import { createGfcReferenceStore } from '../../lib/explorer/data/gfc.js';
import { createRpcClient } from '../../lib/explorer/data/rpc.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const token = '0x7262cca91938ede6bb6560f81104aa410848e7f3';
const treasury = '0xed17f3a500f8d7c23cfd5c6e8782f4bd914e4280';
const presale = '0xd03ebb0c507fe55f6b5f9a79076d8ec259b47399';
const hash = `0x${'ab'.repeat(32)}`;

function params(values = {}) { return new URLSearchParams(values); }

function apiProvider(store) {
  return {
    status: async () => ({ available: true }),
    activity: async () => ({ transfers: [] }),
    transaction: async () => null,
    references: () => ({ references: store.list() }),
    reference: (value) => store.detail(value),
    gfcSnapshot: async () => ({ latestBlock: 1 }),
    address: async (value) => ({ address: value }),
  };
}

test('GFC reference routes expose published references without inventing unknown entries', async () => {
  const store = createGfcReferenceStore({ rootDir: root });
  const handle = createApiHandler(apiProvider(store));
  const list = await handle({ method: 'GET', pathname: '/api/gfc/references', searchParams: params(), clientKey: 'refs-1' });
  assert.equal(list.statusCode, 200);
  assert.equal(list.payload.references.length, 4);
  const known = await handle({ method: 'GET', pathname: '/api/gfc/reference/gfc-token-pilot', searchParams: params(), clientKey: 'refs-2' });
  assert.equal(known.statusCode, 200);
  assert.equal(known.payload.address.toLowerCase(), token);
  assert.equal(known.payload.deployment.blockNumber, 44738545);
  assert.equal(known.payload.compiler.version, 'v0.8.36+commit.8a079791');
  assert.equal(known.payload.properties.supply.initialSupplyTokens, '1000000000');
  assert.equal(known.payload.manifestUrl, 'https://globalfoundationcoin.org/contracts/base-sepolia/gfc-token-pilot/test-contract.json');
  const unknown = await handle({ method: 'GET', pathname: '/api/gfc/reference/not-published', searchParams: params(), clientKey: 'refs-3' });
  assert.equal(unknown.statusCode, 404);
  assert.equal(unknown.payload.error.code, 'REFERENCE_NOT_FOUND');
});

test('address route validates Ethereum addresses before provider lookup', async () => {
  let called = false;
  const provider = apiProvider(createGfcReferenceStore({ rootDir: root }));
  provider.address = async () => { called = true; return {}; };
  const handle = createApiHandler(provider);
  const result = await handle({ method: 'GET', pathname: '/api/address/not-an-address', searchParams: params(), clientKey: 'addr' });
  assert.equal(result.statusCode, 400);
  assert.equal(result.payload.error.code, 'INVALID_ADDRESS');
  assert.equal(called, false);
});

test('malformed percent-encoded route values return validation errors instead of server errors', async () => {
  const handle = createApiHandler(apiProvider(createGfcReferenceStore({ rootDir: root })));
  const transaction = await handle({ method: 'GET', pathname: '/api/transaction/%ZZ', searchParams: params(), clientKey: 'bad-1' });
  assert.equal(transaction.statusCode, 400);
  assert.equal(transaction.payload.error.code, 'INVALID_TRANSACTION_HASH');
  const address = await handle({ method: 'GET', pathname: '/api/address/%E0%A4%A', searchParams: params(), clientKey: 'bad-2' });
  assert.equal(address.statusCode, 400);
  assert.equal(address.payload.error.code, 'INVALID_ADDRESS');
});

test('GFC static references are sourced from the published Base Sepolia registry', () => {
  const store = createGfcReferenceStore({ rootDir: root });
  const registry = store.loadRegistry();
  assert.equal(registry.registryId, 'gfc-base-sepolia-contract-registry');
  assert.equal(registry.network.chainId, 84532);
  assert.equal(store.find(token)?.id, 'gfc-token-pilot');
  assert.equal(store.find(treasury)?.id, 'gfc-test-treasury');
  assert.equal(store.find(presale)?.id, 'gfc-test-presale');
});

test('published GFC registry preserves testnet, mainnet, presale and audit boundaries', () => {
  const store = createGfcReferenceStore({ rootDir: root });
  const registry = store.loadRegistry();
  assert.equal(registry.projectStatus.officialMainnetContractsPublished, false);
  assert.equal(registry.projectStatus.activePublicMainnetPresale, false);
  assert.equal(registry.projectStatus.externalAuditReportsPublished, false);
  for (const contract of registry.contracts) {
    assert.equal(contract.classification.testnetOnly, true);
    assert.equal(contract.status.audit, 'not-audited');
  }
});

test('GFC snapshot maps RPC state without turning unavailable reads into invented values', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    let result = null;
    if (body.method === 'eth_chainId') result = '0x14a34';
    else if (body.method === 'eth_blockNumber') result = '0x2c8b4f0';
    else if (body.method === 'eth_getBalance') result = '0x0';
    else if (body.method === 'eth_getCode') result = '0x6000';
    else if (body.method === 'eth_call') {
      const data = body.params?.[0]?.data || '';
      if (data === '0x18160ddd') result = `0x${(10n ** 27n).toString(16).padStart(64, '0')}`;
      else if (data === '0x8da5cb5b') result = `0x${'0'.repeat(24)}${treasury.slice(2)}`;
      else if (data === '0xe30c3978') result = `0x${'0'.repeat(64)}`;
      else if (data.startsWith('0x70a08231')) result = null;
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const rpc = createRpcClient({ rpc: { urls: ['https://example.invalid'] }, upstreamTimeoutMs: 1000 });
    const snapshot = await rpc.getGfcSnapshot({ treasuryAddress: treasury, presaleAddress: presale });
    assert.equal(snapshot.latestBlock, 46707952);
    assert.equal(snapshot.token.totalSupplyBaseUnits, (10n ** 27n).toString());
    assert.equal(snapshot.token.owner, treasury);
    assert.equal(snapshot.token.pendingOwner, null);
    assert.equal(snapshot.treasury.tokenBalanceBaseUnits, null);
    assert.equal(snapshot.presale.codePresent, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GFC snapshot fails closed when RPC status is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    const rpc = createRpcClient({ rpc: { urls: ['https://example.invalid'] }, upstreamTimeoutMs: 1000 });
    await assert.rejects(() => rpc.getGfcSnapshot({ treasuryAddress: treasury, presaleAddress: presale }), /No configured Base Sepolia RPC endpoint/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
