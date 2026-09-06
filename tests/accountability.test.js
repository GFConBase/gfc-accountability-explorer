import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountabilityModel, VERIFICATION_STATES } from '../server/model/accountability.js';

const base = {
  transactionHash: `0x${'12'.repeat(32)}`,
  blockNumber: 12345,
  timestamp: '2026-09-06T12:00:00.000Z',
  from: `0x${'11'.repeat(20)}`,
  to: `0x${'22'.repeat(20)}`,
  status: 'success',
  tokenTransfers: [],
};

test('never upgrades authority, rules or decisions from transaction visibility alone', () => {
  const model = buildAccountabilityModel(base, { sourceLabel: 'TEST FIXTURE' });
  assert.equal(model.authority.status, 'not_verifiable');
  assert.equal(model.rules.status, 'not_verifiable');
  assert.equal(model.decisions.status, 'not_verifiable');
  assert.match(model.authority.summary, /does not establish/u);
});

test('verifies only the onchain transfer scope when a tGFC transfer is present', () => {
  const transaction = {
    ...base,
    tokenTransfers: [{
      transactionHash: base.transactionHash,
      logIndex: 0,
      from: base.from,
      to: base.to,
      amount: '1.5',
      symbol: 'tGFC',
    }],
  };
  const model = buildAccountabilityModel(transaction, { sourceLabel: 'TEST FIXTURE' });
  assert.equal(model.funds.status, 'verified');
  assert.equal(model.outcomes.status, 'partially_verifiable');
  assert.equal(model.evidence.status, 'verified');
  assert.match(model.funds.limitations.join(' '), /does not establish/u);
});

test('reverted transaction is represented without claiming successful outcome', () => {
  const model = buildAccountabilityModel({ ...base, status: 'reverted' }, { sourceLabel: 'TEST FIXTURE' });
  assert.equal(model.outcomes.status, 'verified');
  assert.match(model.outcomes.summary, /reverted/u);
});

test('all model states stay inside the declared vocabulary', () => {
  const model = buildAccountabilityModel(base, { sourceLabel: 'TEST FIXTURE' });
  for (const value of Object.values(model)) assert.ok(VERIFICATION_STATES.includes(value.status));
});
