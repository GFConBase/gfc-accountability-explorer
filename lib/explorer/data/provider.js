import { NETWORK } from '../config.js';
import { boundedLimit, normalizeAddress, normalizeTxHash } from '../validation.js';
import { createGraphClient } from './graph.js';
import { createRpcClient } from './rpc.js';
import { createBlockscoutClient } from './blockscout.js';
import { buildAccountabilityModel } from '../model/accountability.js';
import { mergeTransactionWithTransfers, summarizeActivity } from '../model/transform.js';

export function createDataProvider(config) {
  const graph = createGraphClient(config);
  const rpc = createRpcClient(config);
  const blockscout = createBlockscoutClient(config);

  function analystProvenance({ secondaryTransactionIndex = null } = {}) {
    return {
      primary: {
        id: 'the_graph',
        label: 'The Graph',
        role: 'Primary indexed tGFC activity and Transfer-event evidence. This source does not provide the historical transaction status/from/to metadata included by Blockscout.',
      },
      secondary: secondaryTransactionIndex
        ? {
            id: 'base_blockscout',
            label: secondaryTransactionIndex,
            role: 'Secondary indexed historical transaction metadata; not a direct JSON-RPC receipt.',
          }
        : null,
      ai: {
        role: 'Explanatory only; not an evidence source and cannot change verification states.',
      },
      verification: {
        authority: 'deterministic_accountability_model',
        role: 'Authoritative Funds → Authority → Rules → Decisions → Outcomes → Evidence states.',
      },
    };
  }

  async function chooseForActivity() {
    if (config.mode === 'graph') {
      if (!graph) {
        throw Object.assign(
          new Error('The Graph is not configured.'),
          { code: 'GRAPH_NOT_CONFIGURED' },
        );
      }

      return { provider: 'graph', client: graph };
    }

    if (config.mode === 'rpc') {
      return { provider: 'rpc', client: rpc };
    }

    if (graph) {
      return { provider: 'graph', client: graph };
    }

    return { provider: 'rpc', client: rpc };
  }

  async function activity({ address = null, limit = 25 } = {}) {
    const normalizedLimit = boundedLimit(limit, 25, 50);
    const normalizedAddress = address ? normalizeAddress(address) : null;
    const contractAddress = NETWORK.contract.toLowerCase();
    const contractScope = normalizedAddress === contractAddress;
    const filterAddress = contractScope ? null : normalizedAddress;
    const selected = await chooseForActivity();

    try {
      const data =
        selected.provider === 'graph'
          ? await selected.client.getActivity({
              address: filterAddress,
              limit: normalizedLimit,
            })
          : await selected.client.getRecentTransferLogs({
              address: filterAddress,
              limit: normalizedLimit,
            });

      return {
        source: selected.provider === 'graph' ? 'the_graph' : 'base_rpc',
        sourceLabel:
          selected.provider === 'graph'
            ? 'The Graph'
            : 'Base Sepolia JSON-RPC',
        sourceMode:
          selected.provider === 'graph'
            ? 'primary'
            : graph && config.mode === 'auto'
              ? 'fallback'
              : 'active',
        queryScope: contractScope ? 'token_contract' : normalizedAddress ? 'address' : 'recent',
        queryAddress: normalizedAddress,
        warning:
          selected.provider === 'rpc'
            ? 'RPC fallback shows only a bounded recent block window and must not be interpreted as complete historical indexing.'
            : data.indexingErrors
              ? 'The configured subgraph reports indexing errors.'
              : null,
        transfers: data.transfers,
        summary: summarizeActivity(data.transfers, data),
      };
    } catch (error) {
      if (config.mode === 'auto' && selected.provider === 'graph') {
        const data = await rpc.getRecentTransferLogs({
          address: filterAddress,
          limit: normalizedLimit,
        });

        return {
          source: 'base_rpc',
          sourceLabel: 'Base Sepolia JSON-RPC',
          sourceMode: 'fallback',
          queryScope: contractScope ? 'token_contract' : normalizedAddress ? 'address' : 'recent',
          queryAddress: normalizedAddress,
          warning:
            'The Graph was configured but unavailable, so this response uses the bounded Base Sepolia RPC fallback. It is not complete historical indexing.',
          transfers: data.transfers,
          summary: summarizeActivity(data.transfers, data),
        };
      }

      throw error;
    }
  }

  function transactionFromGraph(txHash, transfers) {
    const first = transfers[0];

    return {
      transactionHash: txHash,
      blockNumber: first?.blockNumber ?? null,
      timestamp: first?.timestamp ?? null,

      // These are deliberately NOT inferred from ERC-20 Transfer.from/to.
      // A token-event sender is not necessarily the transaction sender (`from`).
      from: null,
      to: null,

      valueWei: null,

      // The Graph event establishes indexed event evidence, but this
      // fallback does not claim to possess the transaction receipt.
      status: 'unknown',
      receiptAvailable: false,
      executionEvidenceKind: 'indexed_event',

      contract: NETWORK.contract,
      network: NETWORK.name,
      chainId: NETWORK.chainId,
      tokenTransfers: transfers,
    };
  }

  async function transaction(hash) {
    const txHash = normalizeTxHash(hash);

    if (config.mode === 'rpc') {
      const baseTransaction = await rpc.getTransaction(txHash);
      if (!baseTransaction) return null;

      const merged = mergeTransactionWithTransfers(
        baseTransaction,
        baseTransaction.tokenTransfers || [],
      );

      const sourceLabel = 'Base Sepolia JSON-RPC';

      return {
        source: 'base_rpc',
        sourceLabel,
        sourceMode: 'active',
        warning: null,
        transaction: merged,
        accountability: buildAccountabilityModel(merged, { sourceLabel }),
      };
    }

    let graphTransfers = null;
    let graphFailure = null;

    if (graph) {
      try {
        graphTransfers = await graph.getTransactionTransfers(txHash);
      } catch (error) {
        graphFailure = error;

        if (config.mode === 'graph') {
          throw Object.assign(
            new Error('The Graph is unavailable for this transaction.'),
            { code: 'GRAPH_UNAVAILABLE' },
          );
        }
      }
    } else if (config.mode === 'graph') {
      throw Object.assign(
        new Error('The Graph is not configured.'),
        { code: 'GRAPH_NOT_CONFIGURED' },
      );
    }

    let baseTransaction = null;
    let rpcFailure = null;

    try {
      baseTransaction = await rpc.getTransaction(txHash);
    } catch (error) {
      rpcFailure = error;
    }

    if (baseTransaction) {
      let transfers = baseTransaction.tokenTransfers || [];
      let source = 'base_rpc';
      let sourceLabel = 'Base Sepolia JSON-RPC';
      let sourceMode = 'active';
      let warning = null;

      if (Array.isArray(graphTransfers) && graphTransfers.length) {
        transfers = graphTransfers;
        source = 'the_graph_plus_rpc';
        sourceLabel = 'The Graph + Base Sepolia JSON-RPC';
        sourceMode = 'composed';
      } else if (graphFailure) {
        warning =
          'The Graph was unavailable; transaction execution evidence uses Base Sepolia RPC only.';
      } else if (graph && Array.isArray(graphTransfers)) {
        warning =
          'The configured subgraph returned no tGFC transfer entities for this transaction; transaction execution evidence comes from Base Sepolia RPC.';
      }

      const merged = mergeTransactionWithTransfers(
        baseTransaction,
        transfers,
      );

      return {
        source,
        sourceLabel,
        sourceMode,
        warning,
        transaction: merged,
        accountability: buildAccountabilityModel(merged, { sourceLabel }),
      };
    }

    let indexedTransaction = null;
    let blockscoutFailure = null;
    if (blockscout) {
      try {
        indexedTransaction = await blockscout.getTransaction(txHash);
      } catch (error) {
        blockscoutFailure = error;
      }
    }

    if (indexedTransaction) {
      let transfers = indexedTransaction.tokenTransfers || [];
      let source = 'base_blockscout';
      let sourceLabel = 'Base Sepolia Blockscout';
      let sourceMode = 'historical_fallback';

      if (Array.isArray(graphTransfers) && graphTransfers.length) {
        transfers = graphTransfers;
        source = 'the_graph_plus_blockscout';
        sourceLabel = 'The Graph + Base Sepolia Blockscout';
        sourceMode = 'composed';
      }

      const merged = mergeTransactionWithTransfers(indexedTransaction, transfers);
      const warning = rpcFailure
        ? 'The configured Base Sepolia RPC could not serve this transaction lookup. Historical transaction evidence is shown from Base Sepolia Blockscout indexing instead.'
        : 'Historical transaction evidence is shown from Base Sepolia Blockscout indexing; it is not represented as a direct JSON-RPC receipt.';

      return {
        source,
        sourceLabel,
        sourceMode,
        warning,
        transaction: merged,
        accountability: buildAccountabilityModel(merged, { sourceLabel }),
      };
    }

    if (Array.isArray(graphTransfers) && graphTransfers.length) {
      const graphTransaction = transactionFromGraph(
        txHash,
        graphTransfers,
      );

      const sourceLabel = 'The Graph';

      return {
        source: 'the_graph',
        sourceLabel,
        sourceMode: 'primary',
        warning:
          'Transaction receipt data is currently unavailable from Base Sepolia RPC. Indexed tGFC Transfer evidence remains available through The Graph; receipt-dependent transaction facts are marked unavailable.',
        transaction: graphTransaction,
        accountability: buildAccountabilityModel(graphTransaction, {
          sourceLabel,
        }),
      };
    }

    if (rpcFailure) {
      throw rpcFailure;
    }

    if (blockscoutFailure) {
      // A successful RPC null result is sufficient to classify the hash as not found;
      // otherwise surface the indexer failure only when no primary source answered.
      if (baseTransaction === null) return null;
      throw blockscoutFailure;
    }

    return null;
  }

  async function analystEvidence({ scope = 'recent', target = null, limit = 30 } = {}) {
    if (!graph) {
      throw Object.assign(
        new Error('The Accountability Analyst requires The Graph to be configured.'),
        { code: 'GRAPH_REQUIRED_FOR_ANALYST' },
      );
    }

    const normalizedLimit = boundedLimit(limit, 30, 40);

    if (scope === 'recent' || scope === 'address') {
      const normalizedAddress = scope === 'address' ? normalizeAddress(target) : null;
      let data;
      try {
        data = await graph.getActivity({ address: normalizedAddress, limit: normalizedLimit });
      } catch {
        throw Object.assign(
          new Error('The Graph is unavailable for the Accountability Analyst.'),
          { code: 'GRAPH_UNAVAILABLE' },
        );
      }

      const summary = summarizeActivity(data.transfers, data);
      return {
        source: 'the_graph',
        sourceLabel: 'The Graph',
        scope,
        target: normalizedAddress,
        network: NETWORK.name,
        chainId: NETWORK.chainId,
        contract: NETWORK.contract,
        token: NETWORK.token,
        meta: {
          indexedBlock: summary.latestIndexedOrScannedBlock || null,
          completeHistory: Boolean(summary.completeHistory),
          indexingErrors: Boolean(data.indexingErrors),
          transferCount: data.transfers.length,
          visibleAddressCount: summary.visibleAddresses || 0,
        },
        provenance: analystProvenance(),
        transfers: data.transfers.map((transfer) => ({
          transactionHash: transfer.transactionHash,
          logIndex: transfer.logIndex,
          blockNumber: transfer.blockNumber,
          timestamp: transfer.timestamp,
          from: transfer.from,
          to: transfer.to,
          amount: transfer.amount,
          amountUnit: 'token',
          amountNormalized: true,
          symbol: transfer.symbol,
          source: 'the_graph',
          sourceLabel: 'The Graph',
          provenanceRole: 'Primary indexed tGFC Transfer-event evidence.',
        })),
        deterministicNote:
          'This aggregate packet contains indexed transfer evidence only. Each transfer.amount is already normalized to the human-readable token amount and must not be treated as raw/base units or decimal-scaled again. It does not establish governance authority, policy compliance, economic purpose, outcomes, or impact.',
      };
    }

    if (scope === 'transaction') {
      const txHash = normalizeTxHash(target);
      let transfers;
      try {
        transfers = await graph.getTransactionTransfers(txHash);
      } catch {
        throw Object.assign(
          new Error('The Graph is unavailable for the Accountability Analyst.'),
          { code: 'GRAPH_UNAVAILABLE' },
        );
      }

      let transactionRecord = null;
      try {
        transactionRecord = await blockscout?.getTransaction(txHash);
      } catch {
        transactionRecord = null;
      }

      const graphTransaction = transactionRecord
        ? mergeTransactionWithTransfers(transactionRecord, transfers)
        : transactionFromGraph(txHash, transfers);
      const sourceLabel = transactionRecord
        ? 'The Graph + Base Sepolia Blockscout'
        : 'The Graph';
      const accountability = buildAccountabilityModel(graphTransaction, { sourceLabel });

      return {
        source: 'the_graph',
        sourceLabel: 'The Graph',
        scope: 'transaction',
        target: txHash,
        network: NETWORK.name,
        chainId: NETWORK.chainId,
        contract: NETWORK.contract,
        token: NETWORK.token,
        meta: {
          indexedBlock: transfers.reduce((max, item) => Math.max(max, Number(item.blockNumber || 0)), 0) || null,
          completeHistory: true,
          indexingErrors: false,
          transferCount: transfers.length,
          secondaryTransactionIndex: transactionRecord ? 'Base Sepolia Blockscout' : null,
        },
        provenance: analystProvenance({
          secondaryTransactionIndex: transactionRecord ? 'Base Sepolia Blockscout' : null,
        }),
        transaction: {
          transactionHash: graphTransaction.transactionHash,
          blockNumber: graphTransaction.blockNumber,
          timestamp: graphTransaction.timestamp,
          from: graphTransaction.from,
          to: graphTransaction.to,
          status: graphTransaction.status,
          receiptAvailable: Boolean(graphTransaction.receiptAvailable),
          executionEvidenceKind: graphTransaction.executionEvidenceKind,
          source: transactionRecord ? 'base_blockscout' : 'the_graph_transfer_context',
          sourceLabel: transactionRecord ? 'Base Sepolia Blockscout' : 'The Graph',
          provenanceRole: transactionRecord
            ? 'Secondary indexed historical transaction metadata. Status, transaction sender (`from`), transaction target (`to`), transaction timestamp and transaction block in this object come from Base Sepolia Blockscout.'
            : 'Transaction reference context derived only from The Graph indexed tGFC Transfer evidence. No transaction status, sender (`from`) or target (`to`) is established unless explicitly populated by the available Graph evidence.',
        },
        transfers: transfers.map((transfer) => ({
          transactionHash: transfer.transactionHash,
          logIndex: transfer.logIndex,
          blockNumber: transfer.blockNumber,
          timestamp: transfer.timestamp,
          from: transfer.from,
          to: transfer.to,
          amount: transfer.amount,
          amountUnit: 'token',
          amountNormalized: true,
          symbol: transfer.symbol,
          source: 'the_graph',
          sourceLabel: 'The Graph',
          provenanceRole: 'Primary indexed tGFC Transfer-event evidence.',
        })),
        accountability,
        deterministicNote:
          'The deterministic accountability states are authoritative. The AI may explain them but must not upgrade or replace them. The Graph supplies primary indexed tGFC Transfer-event evidence. When transaction.source is base_blockscout, transaction status/from/to/timestamp/block metadata is secondary Base Sepolia Blockscout evidence and must never be attributed to The Graph. Each transfer.amount is already normalized to the human-readable token amount and must not be treated as raw/base units or decimal-scaled again.',
      };
    }

    throw new TypeError('Unsupported analyst scope.');
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
      return {
        ...base,
        available: false,
        activeSource: 'unavailable',
        message:
          'The Graph is required by DATA_SOURCE_MODE but is not configured.',
      };
    }

    if (graph && config.mode !== 'rpc') {
      try {
        const graphStatus = await graph.status();

        return {
          ...base,
          available: graphStatus.available,
          activeSource: 'the_graph',
          ...graphStatus,
        };
      } catch {
        if (config.mode === 'graph') {
          return {
            ...base,
            available: false,
            activeSource: 'the_graph',
            message: 'The Graph is configured but unavailable.',
          };
        }
      }
    }

    try {
      const rpcStatus = await rpc.status();

      return {
        ...base,
        available: rpcStatus.available,
        activeSource: 'base_rpc',
        ...rpcStatus,
      };
    } catch {
      return {
        ...base,
        available: false,
        activeSource: 'unavailable',
        message:
          'No configured live data source is currently reachable.',
      };
    }
  }

  return {
    activity,
    transaction,
    analystEvidence,
    status,
  };
}
