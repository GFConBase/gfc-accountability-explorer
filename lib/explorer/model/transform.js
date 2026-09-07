import { NETWORK } from '../config.js';

export function summarizeActivity(transfers, metadata = {}) {
  const list = Array.isArray(transfers) ? transfers : [];
  const addresses = new Set();
  let totalBaseUnits = 0n;

  for (const item of list) {
    if (item?.from) addresses.add(item.from.toLowerCase());
    if (item?.to) addresses.add(item.to.toLowerCase());
    try {
      totalBaseUnits += BigInt(item?.amountBaseUnits || '0');
    } catch {
      // Malformed values are ignored here; upstream normalization is responsible for rejecting them.
    }
  }

  return {
    network: NETWORK.name,
    chainId: NETWORK.chainId,
    contract: NETWORK.contract,
    token: NETWORK.token.symbol,
    visibleTransfers: list.length,
    visibleAddresses: addresses.size,
    latestIndexedOrScannedBlock: metadata.latestBlock ?? null,
    scannedFromBlock: metadata.scannedFromBlock ?? null,
    completeHistory: Boolean(metadata.completeHistory),
    totalVisibleBaseUnits: totalBaseUnits.toString(),
  };
}

export function mergeTransactionWithTransfers(transaction, transfers) {
  if (!transaction) return null;
  const normalized = Array.isArray(transfers) ? transfers : [];
  return { ...transaction, tokenTransfers: normalized };
}
