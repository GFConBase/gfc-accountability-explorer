import { NETWORK } from '../config.js';
import { isAddress, normalizeTxHash } from '../validation.js';
import { formatTokenAmount } from './utils.js';

function blockscoutError(message, code = 'BLOCKSCOUT_UNAVAILABLE', details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function addressHash(value) {
  const hash = typeof value === 'string' ? value : value?.hash;
  return isAddress(hash) ? hash.toLowerCase() : null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function normalizeTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status === 'ok' || status === 'success') return 'success';
  if (status === 'error' || status === 'reverted' || status === 'failed') return 'reverted';
  return 'unknown';
}

function normalizeTransfer(item, fallbackHash, fallbackTimestamp, fallbackBlock) {
  const contract = String(item?.token?.address_hash || item?.token?.address || '').toLowerCase();
  if (contract !== NETWORK.contract.toLowerCase()) return null;
  if (String(item?.token?.type || '').toUpperCase() !== 'ERC-20') return null;

  const from = addressHash(item?.from);
  const to = addressHash(item?.to);
  if (!from || !to) return null;

  const rawValue = item?.total?.value ?? item?.value;
  if (rawValue === null || rawValue === undefined || !/^\d+$/u.test(String(rawValue))) return null;

  const amountBaseUnits = String(rawValue);
  const decimals = Number.parseInt(String(item?.token?.decimals ?? item?.total?.decimals ?? NETWORK.token.decimals), 10);
  const safeDecimals = Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : NETWORK.token.decimals;
  const transactionHash = normalizeTxHash(item?.transaction_hash || fallbackHash);
  const logIndex = numberOrNull(item?.log_index) ?? 0;

  return {
    id: `${transactionHash}:${logIndex}`,
    transactionHash,
    logIndex,
    blockNumber: numberOrNull(item?.block_number) ?? fallbackBlock,
    timestamp: normalizeTimestamp(item?.timestamp) || fallbackTimestamp,
    from,
    to,
    amountBaseUnits,
    amount: formatTokenAmount(BigInt(amountBaseUnits), safeDecimals),
    symbol: NETWORK.token.symbol,
    contract: NETWORK.contract,
    network: NETWORK.name,
  };
}

export function createBlockscoutClient(config) {
  const apiUrl = config?.blockscout?.apiUrl;
  if (!apiUrl) return null;

  async function getJson(pathname) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.upstreamTimeoutMs);
    timeout.unref?.();

    try {
      const response = await fetch(`${apiUrl}${pathname}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });

      if (response.status === 404) return null;
      if (!response.ok) {
        throw blockscoutError(`Blockscout returned HTTP ${response.status}.`, 'BLOCKSCOUT_UPSTREAM_ERROR', {
          httpStatus: response.status,
        });
      }

      try {
        return await response.json();
      } catch {
        throw blockscoutError('Blockscout returned invalid JSON.', 'BLOCKSCOUT_UPSTREAM_ERROR');
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw blockscoutError('Blockscout request timed out.', 'BLOCKSCOUT_UPSTREAM_ERROR');
      }
      if (typeof error?.code === 'string' && error.code.startsWith('BLOCKSCOUT_')) throw error;
      throw blockscoutError('Base Sepolia Blockscout is currently unavailable.', 'BLOCKSCOUT_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getTransaction(hash) {
    const txHash = normalizeTxHash(hash);
    const payload = await getJson(`/transactions/${encodeURIComponent(txHash)}`);
    if (!payload) return null;
    if (typeof payload !== 'object' || normalizeTxHash(payload.hash || txHash) !== txHash) {
      throw blockscoutError('Blockscout returned an invalid transaction response.', 'BLOCKSCOUT_UPSTREAM_ERROR');
    }

    const timestamp = normalizeTimestamp(payload.timestamp);
    const blockNumber = numberOrNull(payload.block_number);
    const tokenTransfers = Array.isArray(payload.token_transfers)
      ? payload.token_transfers
          .map((item) => normalizeTransfer(item, txHash, timestamp, blockNumber))
          .filter(Boolean)
      : [];

    return {
      transactionHash: txHash,
      blockNumber,
      timestamp,
      from: addressHash(payload.from),
      to: addressHash(payload.to),
      valueWei: /^\d+$/u.test(String(payload.value ?? '')) ? String(payload.value) : null,
      status: normalizeStatus(payload.status),
      receiptAvailable: false,
      executionEvidenceKind: 'indexed_transaction',
      contract: NETWORK.contract,
      network: NETWORK.name,
      chainId: NETWORK.chainId,
      tokenTransfers,
    };
  }

  return { getTransaction };
}
