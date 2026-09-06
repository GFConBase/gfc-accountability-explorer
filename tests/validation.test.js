import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedLimit, isAddress, isTxHash, normalizeAddress, normalizeTxHash } from '../server/validation.js';

const address = '0x7262Cca91938ede6bB6560F81104Aa410848e7f3';
const hash = `0x${'ab'.repeat(32)}`;

test('validates and normalizes Ethereum addresses', () => {
  assert.equal(isAddress(address), true);
  assert.equal(normalizeAddress(address), address.toLowerCase());
  assert.equal(isAddress('0x1234'), false);
  assert.throws(() => normalizeAddress('not-an-address'), /Invalid Ethereum address/u);
});

test('validates and normalizes transaction hashes', () => {
  assert.equal(isTxHash(hash), true);
  assert.equal(normalizeTxHash(hash), hash);
  assert.equal(isTxHash(`0x${'zz'.repeat(32)}`), false);
  assert.throws(() => normalizeTxHash('0x01'), /Invalid transaction hash/u);
});

test('bounds public query limits', () => {
  assert.equal(boundedLimit(null), 25);
  assert.equal(boundedLimit('50'), 50);
  assert.throws(() => boundedLimit('0'), /between 1 and 50/u);
  assert.throws(() => boundedLimit('500'), /between 1 and 50/u);
  assert.throws(() => boundedLimit('abc'), /between 1 and 50/u);
});
