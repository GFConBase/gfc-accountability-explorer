import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTransactionWithTransfers, summarizeActivity } from '../server/model/transform.js';
import { formatTokenAmount, safeIsoFromUnix, topicToAddress } from '../server/data/utils.js';

test('summarizes empty data without inventing values', () => {
  const summary = summarizeActivity([], { latestBlock: null, scannedFromBlock: null, completeHistory: false });
  assert.equal(summary.visibleTransfers, 0);
  assert.equal(summary.visibleAddresses, 0);
  assert.equal(summary.totalVisibleBaseUnits, '0');
  assert.equal(summary.completeHistory, false);
});

test('ignores malformed numeric data in summary instead of crashing', () => {
  const summary = summarizeActivity([{ from: '0x1', to: '0x2', amountBaseUnits: 'not-a-number' }]);
  assert.equal(summary.visibleTransfers, 1);
  assert.equal(summary.totalVisibleBaseUnits, '0');
});

test('formats ERC-20 base units without floating point loss', () => {
  assert.equal(formatTokenAmount(1500000000000000000n, 18), '1.5');
  assert.equal(formatTokenAmount(1000000000000000000n, 18), '1');
});

test('decodes indexed address topics and rejects malformed topics', () => {
  assert.equal(topicToAddress(`0x${'0'.repeat(24)}${'ab'.repeat(20)}`), `0x${'ab'.repeat(20)}`);
  assert.throws(() => topicToAddress('0x1234'), /Invalid indexed address topic/u);
});

test('date conversion and transaction merge handle unavailable values', () => {
  assert.equal(safeIsoFromUnix(-1), null);
  assert.equal(mergeTransactionWithTransfers(null, []), null);
  assert.deepEqual(mergeTransactionWithTransfers({ transactionHash: 'x' }, []), { transactionHash: 'x', tokenTransfers: [] });
});
