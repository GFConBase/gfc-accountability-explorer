import { NETWORK } from '../config.js';
import { boundedLimit, normalizeAddress, normalizeTxHash } from '../validation.js';
import { createGraphClient } from './graph.js';
import { createRpcClient } from './rpc.js';
import { buildAccountabilityModel } from '../model/accountability.js';
import { mergeTransactionWithTransfers, summarizeActivity } from '../model/transform.js';

export function createDataProvider(config) {
  const graph = createGraphClient(config);
  const rpc = createRpcClient(config);

  async function chooseForActivity() {
    if (config.mode === 'graph') {
      if (!graph) throw Object.assign(new Error('The Graph is not configured.'), { code: 'GRAPH_NOT_CONFIGURED' });
      return { provider: 'graph', client: graph };
    }
    if (config.mode === 'rpc') return { provider: 'rpc', client: rpc };
    if (graph) return { provider: 'graph', client: graph };
    return { provider: 'rpc', client: rpc };
  }

  async function activity({ address = null, limit = 25 } = {}) {
    const normalizedLimit = boundedLimit(limit, 25, 50);
    const normalizedAddress = address ? normalizeAddress(address) : null;
    const selected = await chooseForActivity();

    try {
      const data = selected.provider === 'graph'
        ? await selected.client.getActivity({ address: normalizedAddress, limit: normalizedLimit })
        : await selected.client.getRecentTransferLogs({ address: normalizedAddress, limit: normalizedLimit });

      return {
        source: selected.provider === 'graph' ? 'the_graph' : 'base_rpc',
        sourceLabel: selected.provider === 'graph' ? 'The Graph' : 'Base Sepolia JSON-RPC',
        sourceMode: selected.provider === 'graph' ? 'primary' : graph && config.mode === 'auto' ? 'fallback' : 'active',
        warning: selected.provider === 'rpc'
          ? 'RPC fallback shows only a bounded recent block window and must not be interpreted as complete historical indexing.'
          : data.indexingErrors
            ? 'The configured subgraph reports indexing errors.'
            : null,
        transfers: data.transfers,
        summary: summarizeActivity(data.transfers, data),
      };
    } catch (error) {
      if (config.mode === 'auto' && selected.provider === 'graph') {
        const data = await rpc.getRecentTransferLogs({ address: normalizedAddress, limit: normalizedLimit });
        return {
          source: 'base_rpc',
          sourceLabel: 'Base Sepolia JSON-RPC',
          sourceMode: 'fallback',
          warning: 'The Graph was configured but unavailable, so this response uses the bounded Base Sepolia RPC fallback. It is not complete historical indexing.',
          transfers: data.transfers,
          summary: summarizeActivity(data.transfers, data),
        };
      }
      throw error;
    }
  }

  async function transaction(hash) {
    const txHash = normalizeTxHash(hash);
    const baseTransaction = await rpc.getTransaction(txHash);
    if (!baseTransaction) return null;

    let source = 'base_rpc';
    let sourceLabel = 'Base Sepolia JSON-RPC';
    let sourceMode = 'active';
    let graphWarning = null;
    let transfers = baseTransaction.tokenTransfers || [];

    if (graph && config.mode !== 'rpc') {
      try {
        const graphTransfers = await graph.getTransactionTransfers(txHash);
        if (graphTransfers.length) {
          transfers = graphTransfers;
          source = 'the_graph_plus_rpc';
          sourceLabel = 'The Graph + Base Sepolia JSON-RPC';
          sourceMode = 'composed';
        } else {
          graphWarning = 'The configured subgraph returned no tGFC transfer entities for this transaction; transaction receipt data comes from Base Sepolia RPC.';
        }
      } catch {
        if (config.mode === 'graph') throw Object.assign(new Error('The Graph is unavailable for this transaction.'), { code: 'GRAPH_UNAVAILABLE' });
        graphWarning = 'The Graph was unavailable; transaction evidence uses Base Sepolia RPC only.';
      }
    }

    const merged = mergeTransactionWithTransfers(baseTransaction, transfers);
    return {
      source,
      sourceLabel,
      sourceMode,
      warning: graphWarning,
      transaction: merged,
      accountability: buildAccountabilityModel(merged, { sourceLabel }),
    };
  }

  async function status() {
    const base = {
      project: 'GFC Accountability Explorer',
      network: NETWORK.name,
      chainId: NETWORK.chainId,
      environment: NETWORK.environment,
      contract: NETWORK.contract,
      testnet: true,
      mainnet: false,
      publicPilot: true,
      graphConfigured: Boolean(graph),
      requestedMode: config.mode,
    };

    if (config.mode === 'graph' && !graph) {
      return { ...base, available: false, activeSource: 'unavailable', message: 'The Graph is required by DATA_SOURCE_MODE but is not configured.' };
    }

    if (graph && config.mode !== 'rpc') {
      try {
        const graphStatus = await graph.status();
        return { ...base, available: graphStatus.available, activeSource: 'the_graph', ...graphStatus };
      } catch {
        if (config.mode === 'graph') return { ...base, available: false, activeSource: 'the_graph', message: 'The Graph is configured but unavailable.' };
      }
    }

    try {
      const rpcStatus = await rpc.status();
      return { ...base, available: rpcStatus.available, activeSource: 'base_rpc', ...rpcStatus };
    } catch {
      return { ...base, available: false, activeSource: 'unavailable', message: 'No configured live data source is currently reachable.' };
    }
  }

  return { activity, transaction, status };
}
