import { NETWORK } from '../config.js';
import { isAddress, normalizeAddress, normalizeTxHash } from '../validation.js';
import { withCache } from './cache.js';
import { bigintToHex, formatTokenAmount, hexToBigInt, hexToNumber, safeIsoFromUnix, topicToAddress, TRANSFER_TOPIC } from './utils.js';

function rpcError(message, code = 'RPC_UNAVAILABLE') {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createRpcClient(config) {
  let requestId = 0;

  async function call(method, params = []) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.upstreamTimeoutMs);
    timeout.unref?.();

    try {
      const response = await fetch(config.rpc.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
        signal: controller.signal,
      });

      if (!response.ok) throw rpcError(`Base Sepolia RPC returned HTTP ${response.status}.`);
      const payload = await response.json();
      if (!payload || payload.jsonrpc !== '2.0' || payload.error) {
        const detail = payload?.error?.message ? `: ${String(payload.error.message).slice(0, 160)}` : '';
        throw rpcError(`Base Sepolia RPC request failed${detail}`);
      }
      return payload.result;
    } catch (error) {
      if (error?.name === 'AbortError') throw rpcError('Base Sepolia RPC request timed out.');
      if (error?.code === 'RPC_UNAVAILABLE') throw error;
      throw rpcError('Base Sepolia RPC is currently unavailable from this server.');
    } finally {
      clearTimeout(timeout);
    }
  }

  async function blockTimestamp(blockNumberHex) {
    return withCache(`rpc:block:${blockNumberHex}`, 10 * 60_000, async () => {
      const block = await call('eth_getBlockByNumber', [blockNumberHex, false]);
      return block?.timestamp ? safeIsoFromUnix(hexToBigInt(block.timestamp)) : null;
    });
  }

  async function decodeTransferLog(log) {
    if (!log || log.address?.toLowerCase() !== NETWORK.contract.toLowerCase()) return null;
    if (!Array.isArray(log.topics) || log.topics.length < 3 || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) return null;

    const timestamp = await blockTimestamp(log.blockNumber);
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

    const transfers = (await Promise.all(collected.slice(0, limit).map(decodeTransferLog))).filter(Boolean);
    return {
      transfers,
      latestBlock: latest,
      scannedFromBlock: lowerBound,
      completeHistory: false,
    };
  }

  async function getTransaction(hash) {
    const txHash = normalizeTxHash(hash);
    return withCache(`rpc:tx:${txHash}`, 60_000, async () => {
      const [tx, receipt] = await Promise.all([
        call('eth_getTransactionByHash', [txHash]),
        call('eth_getTransactionReceipt', [txHash]),
      ]);
      if (!tx || !receipt) return null;

      const timestamp = await blockTimestamp(tx.blockNumber);
      const tokenTransfers = (await Promise.all((receipt.logs || []).map(decodeTransferLog))).filter(Boolean);
      return {
        transactionHash: txHash,
        blockNumber: hexToNumber(tx.blockNumber),
        timestamp,
        from: isAddress(tx.from) ? tx.from.toLowerCase() : null,
        to: isAddress(tx.to) ? tx.to.toLowerCase() : null,
        valueWei: hexToBigInt(tx.value || '0x0').toString(),
        status: receipt.status === '0x1' ? 'success' : receipt.status === '0x0' ? 'reverted' : 'unknown',
        contract: NETWORK.contract,
        network: NETWORK.name,
        chainId: NETWORK.chainId,
        tokenTransfers,
      };
    });
  }

  async function status() {
    return withCache('rpc:status', 20_000, async () => {
      const chainIdHex = await call('eth_chainId');
      const chainId = hexToNumber(chainIdHex);
      return {
        available: chainId === NETWORK.chainId,
        source: 'base_rpc',
        sourceLabel: 'Base Sepolia JSON-RPC',
        chainId,
        warning: chainId === NETWORK.chainId ? null : `Configured RPC returned chain ID ${chainId}.`,
      };
    });
  }

  return { getRecentTransferLogs, getTransaction, status };
}
