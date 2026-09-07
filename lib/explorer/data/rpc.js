import { NETWORK } from '../config.js';
import { isAddress, normalizeAddress, normalizeTxHash } from '../validation.js';
import { withCache } from './cache.js';
import {
  bigintToHex,
  formatTokenAmount,
  hexToBigInt,
  hexToNumber,
  safeIsoFromUnix,
  topicToAddress,
  TRANSFER_TOPIC,
} from './utils.js';

function rpcError(message, code = 'RPC_UNAVAILABLE', details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function rpcUrls(config) {
  const configured = Array.isArray(config?.rpc?.urls) && config.rpc.urls.length
    ? config.rpc.urls
    : config?.rpc?.url
      ? [config.rpc.url]
      : [];
  if (!configured.length) throw new TypeError('At least one RPC URL is required.');
  return [...new Set(configured)];
}

function endpointLabel(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'configured endpoint';
  }
}

let rpcClientSequence = 0;

function isNotFoundRpcError(error) {
  const message = String(error?.rpcMessage || error?.message || '').toLowerCase();
  return /(?:transaction|resource).*(?:not found|unknown)|not found.*transaction/u.test(message);
}

export function createRpcClient(config) {
  const endpoints = rpcUrls(config);
  const cacheNamespace = `rpc-client-${++rpcClientSequence}`;
  let requestId = 0;
  let preferredEndpoint = 0;
  const networkChecks = new Map();

  function orderedEndpoints() {
    if (preferredEndpoint <= 0 || preferredEndpoint >= endpoints.length) return endpoints;
    return [endpoints[preferredEndpoint], ...endpoints.filter((_, index) => index !== preferredEndpoint)];
  }

  async function requestRaw(endpoint, method, params = []) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.upstreamTimeoutMs);
    timeout.unref?.();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw rpcError(`Base Sepolia RPC returned HTTP ${response.status}.`, 'RPC_UPSTREAM_ERROR', {
          httpStatus: response.status,
          endpoint: endpointLabel(endpoint),
        });
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw rpcError('Base Sepolia RPC returned invalid JSON.', 'RPC_UPSTREAM_ERROR', {
          endpoint: endpointLabel(endpoint),
        });
      }

      if (!payload || payload.jsonrpc !== '2.0') {
        throw rpcError('Base Sepolia RPC returned an invalid JSON-RPC response.', 'RPC_UPSTREAM_ERROR', {
          endpoint: endpointLabel(endpoint),
        });
      }

      if (payload.error) {
        const rpcMessage = String(payload.error.message || 'JSON-RPC error').slice(0, 200);
        throw rpcError('Base Sepolia RPC rejected the request.', 'RPC_UPSTREAM_ERROR', {
          rpcCode: payload.error.code,
          rpcMessage,
          endpoint: endpointLabel(endpoint),
        });
      }

      return payload.result;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw rpcError('Base Sepolia RPC request timed out.', 'RPC_UPSTREAM_ERROR', {
          endpoint: endpointLabel(endpoint),
        });
      }
      if (typeof error?.code === 'string' && error.code.startsWith('RPC_')) throw error;
      throw rpcError('Base Sepolia RPC is currently unavailable from this server.', 'RPC_UPSTREAM_ERROR', {
        endpoint: endpointLabel(endpoint),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function ensureCorrectNetwork(endpoint) {
    const cached = networkChecks.get(endpoint);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      if (cached.chainId !== NETWORK.chainId) {
        throw rpcError('Configured RPC endpoint is not Base Sepolia.', 'RPC_WRONG_NETWORK', {
          endpoint: endpointLabel(endpoint),
          chainId: cached.chainId,
        });
      }
      return;
    }

    const chainIdHex = await requestRaw(endpoint, 'eth_chainId');
    const chainId = hexToNumber(chainIdHex);
    networkChecks.set(endpoint, { chainId, expiresAt: now + 5 * 60_000 });
    if (chainId !== NETWORK.chainId) {
      throw rpcError('Configured RPC endpoint is not Base Sepolia.', 'RPC_WRONG_NETWORK', {
        endpoint: endpointLabel(endpoint),
        chainId,
      });
    }
  }

  async function call(method, params = [], { preferNonNull = false, allowNotFound = false } = {}) {
    let sawSuccessfulNull = false;
    const failures = [];

    for (const endpoint of orderedEndpoints()) {
      try {
        if (method !== 'eth_chainId') await ensureCorrectNetwork(endpoint);
        const result = await requestRaw(endpoint, method, params);
        const index = endpoints.indexOf(endpoint);
        if (index >= 0) preferredEndpoint = index;

        if (preferNonNull && (result === null || result === undefined)) {
          sawSuccessfulNull = true;
          continue;
        }
        return result;
      } catch (error) {
        if (allowNotFound && isNotFoundRpcError(error)) {
          sawSuccessfulNull = true;
          continue;
        }
        failures.push(error);
      }
    }

    if (sawSuccessfulNull) return null;

    const wrongNetwork = failures.find((error) => error?.code === 'RPC_WRONG_NETWORK');
    if (wrongNetwork && failures.every((error) => error?.code === 'RPC_WRONG_NETWORK')) {
      throw rpcError('All configured RPC endpoints returned the wrong network.', 'RPC_WRONG_NETWORK');
    }

    throw rpcError('No configured Base Sepolia RPC endpoint completed the request.', 'RPC_UNAVAILABLE', {
      failures: failures.map((error) => ({
        code: error?.code || 'RPC_UPSTREAM_ERROR',
        endpoint: error?.endpoint || 'unknown',
      })),
    });
  }

  async function blockTimestamp(blockNumberHex) {
    if (!blockNumberHex) return null;
    return withCache(`${cacheNamespace}:block:${blockNumberHex}`, 10 * 60_000, async () => {
      const block = await call('eth_getBlockByNumber', [blockNumberHex, false], { preferNonNull: true });
      return block?.timestamp ? safeIsoFromUnix(hexToBigInt(block.timestamp)) : null;
    });
  }

  async function decodeTransferLog(log, knownTimestamp = null) {
    if (!log || log.address?.toLowerCase() !== NETWORK.contract.toLowerCase()) return null;
    if (!Array.isArray(log.topics) || log.topics.length < 3 || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) return null;

    const timestamp = knownTimestamp || await blockTimestamp(log.blockNumber);
    const value = hexToBigInt(log.data || '0x0');
    return {
      id: `${String(log.transactionHash).toLowerCase()}:${hexToNumber(log.logIndex)}`,
      transactionHash: normalizeTxHash(log.transactionHash),
      logIndex: hexToNumber(log.logIndex),
      blockNumber: hexToNumber(log.blockNumber),
      timestamp,
      from: topicToAddress(log.topics[1]),
      to: topicToAddress(log.topics[2]),
      amountBaseUnits: value.toString(),
      amount: formatTokenAmount(value, NETWORK.token.decimals),
      symbol: NETWORK.token.symbol,
      contract: NETWORK.contract,
      network: NETWORK.name,
    };
  }

  async function getRecentTransferLogs({ address = null, limit = config.rpc.maxActivity } = {}) {
    const latestHex = await call('eth_blockNumber');
    const latest = hexToNumber(latestHex);
    const lowerBound = Math.max(0, latest - config.rpc.lookbackBlocks + 1);
    const normalized = address ? normalizeAddress(address) : null;
    const topicAddress = normalized ? `0x${'0'.repeat(24)}${normalized.slice(2)}` : null;
    const collected = [];

    for (let to = latest; to >= lowerBound && collected.length < limit; to -= config.rpc.chunkBlocks) {
      const from = Math.max(lowerBound, to - config.rpc.chunkBlocks + 1);
      const baseFilter = {
        address: NETWORK.contract,
        fromBlock: bigintToHex(from),
        toBlock: bigintToHex(to),
        topics: [TRANSFER_TOPIC],
      };

      let logs;
      if (topicAddress) {
        const [sent, received] = await Promise.all([
          call('eth_getLogs', [{ ...baseFilter, topics: [TRANSFER_TOPIC, topicAddress] }]),
          call('eth_getLogs', [{ ...baseFilter, topics: [TRANSFER_TOPIC, null, topicAddress] }]),
        ]);
        const byId = new Map([...sent, ...received].map((log) => [`${log.transactionHash}:${log.logIndex}`, log]));
        logs = [...byId.values()];
      } else {
        logs = await call('eth_getLogs', [baseFilter]);
      }

      logs.sort((a, b) => hexToNumber(b.blockNumber) - hexToNumber(a.blockNumber) || hexToNumber(b.logIndex) - hexToNumber(a.logIndex));
      collected.push(...logs.slice(0, Math.max(0, limit - collected.length)));
    }

    const transfers = (await Promise.all(collected.slice(0, limit).map((log) => decodeTransferLog(log)))).filter(Boolean);
    return {
      transfers,
      latestBlock: latest,
      scannedFromBlock: lowerBound,
      completeHistory: false,
    };
  }

  async function getTransaction(hash) {
    const txHash = normalizeTxHash(hash);
    return withCache(`${cacheNamespace}:tx:${txHash}`, 60_000, async () => {
      const tx = await call('eth_getTransactionByHash', [txHash], {
        preferNonNull: true,
        allowNotFound: true,
      });
      if (!tx) return null;

      const receipt = await call('eth_getTransactionReceipt', [txHash], {
        preferNonNull: true,
        allowNotFound: true,
      });

      const timestamp = tx.blockNumber ? await blockTimestamp(tx.blockNumber) : null;
      const tokenTransfers = receipt
        ? (await Promise.all((receipt.logs || []).map((log) => decodeTransferLog(log, timestamp)))).filter(Boolean)
        : [];

      return {
        transactionHash: txHash,
        blockNumber: tx.blockNumber ? hexToNumber(tx.blockNumber) : null,
        timestamp,
        from: isAddress(tx.from) ? tx.from.toLowerCase() : null,
        to: isAddress(tx.to) ? tx.to.toLowerCase() : null,
        valueWei: hexToBigInt(tx.value || '0x0').toString(),
        status: receipt?.status === '0x1' ? 'success' : receipt?.status === '0x0' ? 'reverted' : 'unknown',
        receiptAvailable: Boolean(receipt),
        executionEvidenceKind: receipt ? 'rpc_receipt' : 'rpc_transaction',
        contract: NETWORK.contract,
        network: NETWORK.name,
        chainId: NETWORK.chainId,
        tokenTransfers,
      };
    });
  }

  async function status() {
    return withCache(`${cacheNamespace}:status`, 20_000, async () => {
      // eth_blockNumber is intentionally used as the health probe because every
      // non-chain request first verifies that the selected endpoint is Base Sepolia.
      const latestBlockHex = await call('eth_blockNumber');
      return {
        available: true,
        source: 'base_rpc',
        sourceLabel: 'Base Sepolia JSON-RPC',
        chainId: NETWORK.chainId,
        latestBlock: hexToNumber(latestBlockHex),
        configuredEndpoints: endpoints.length,
        warning: null,
      };
    });
  }

  return { getRecentTransferLogs, getTransaction, status };
}
