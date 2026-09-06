import { NETWORK } from '../config.js';
import { normalizeAddress, normalizeTxHash } from '../validation.js';
import { withCache } from './cache.js';
import { formatTokenAmount, safeIsoFromUnix } from './utils.js';

function graphError(message, code = 'GRAPH_UNAVAILABLE') {
  const error = new Error(message);
  error.code = code;
  return error;
}

const ACTIVITY_QUERY = `
  query ExplorerActivity($first: Int!) {
    transfers(first: $first, orderBy: timestamp, orderDirection: desc) {
      id
      transactionHash
      logIndex
      blockNumber
      timestamp
      from
      to
      value
      contract
    }
    _meta { block { number hash } hasIndexingErrors }
  }
`;

const SENT_QUERY = `
  query SentTransfers($address: Bytes!, $first: Int!) {
    transfers(first: $first, orderBy: timestamp, orderDirection: desc, where: { from: $address }) {
      id transactionHash logIndex blockNumber timestamp from to value contract
    }
  }
`;

const RECEIVED_QUERY = `
  query ReceivedTransfers($address: Bytes!, $first: Int!) {
    transfers(first: $first, orderBy: timestamp, orderDirection: desc, where: { to: $address }) {
      id transactionHash logIndex blockNumber timestamp from to value contract
    }
  }
`;

const TX_QUERY = `
  query TransactionTransfers($hash: Bytes!) {
    transfers(first: 100, orderBy: logIndex, orderDirection: asc, where: { transactionHash: $hash }) {
      id transactionHash logIndex blockNumber timestamp from to value contract
    }
  }
`;

const META_QUERY = `
  query ExplorerMeta {
    _meta {
      block { number hash }
      hasIndexingErrors
      deployment
    }
  }
`;

export function createGraphClient(config) {
  if (!config.graph.configured) return null;

  const usingStudio = Boolean(config.graph.studioQueryUrl);

  const endpoint = usingStudio
    ? config.graph.studioQueryUrl
    : `${config.graph.gatewayUrl}/subgraphs/id/${encodeURIComponent(config.graph.subgraphId)}`;

  async function query(document, variables = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.upstreamTimeoutMs);
    timeout.unref?.();

    const headers = {
      'content-type': 'application/json',
    };

    if (!usingStudio) {
      headers.authorization = `Bearer ${config.graph.apiKey}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: document,
          variables,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw graphError(`The Graph returned HTTP ${response.status}.`);
      }

      const payload = await response.json();

      if (Array.isArray(payload?.errors) && payload.errors.length) {
        throw graphError(
          `The Graph query failed: ${String(
            payload.errors[0]?.message || 'unknown error',
          ).slice(0, 180)}`,
        );
      }

      if (!payload?.data) {
        throw graphError('The Graph response did not contain data.');
      }

      return payload.data;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw graphError('The Graph request timed out.');
      }

      if (error?.code === 'GRAPH_UNAVAILABLE') {
        throw error;
      }

      throw graphError('The Graph is currently unavailable from this server.');
    } finally {
      clearTimeout(timeout);
    }
  }

  function normalizeTransfer(item) {
    if (!item) return null;

    try {
      const transactionHash = normalizeTxHash(String(item.transactionHash));
      const from = normalizeAddress(String(item.from));
      const to = normalizeAddress(String(item.to));
      const value = BigInt(String(item.value));

      return {
        id: String(item.id),
        transactionHash,
        logIndex: Number(item.logIndex),
        blockNumber: Number(item.blockNumber),
        timestamp: safeIsoFromUnix(Number(item.timestamp)),
        from,
        to,
        amountBaseUnits: value.toString(),
        amount: formatTokenAmount(value, NETWORK.token.decimals),
        symbol: NETWORK.token.symbol,
        contract: NETWORK.contract,
        network: NETWORK.name,
      };
    } catch {
      return null;
    }
  }

  async function getActivity({ address = null, limit = 40 } = {}) {
    if (!address) {
      const data = await withCache(
        `graph:activity:${limit}`,
        20_000,
        () => query(ACTIVITY_QUERY, { first: limit }),
      );

      return {
        transfers: (data.transfers || [])
          .map(normalizeTransfer)
          .filter(Boolean),
        latestBlock: Number(data._meta?.block?.number || 0),
        scannedFromBlock: null,
        completeHistory: true,
        indexingErrors: Boolean(data._meta?.hasIndexingErrors),
      };
    }

    const normalized = normalizeAddress(address);

    const data = await withCache(
      `graph:address:${normalized}:${limit}`,
      20_000,
      async () => {
        const [sent, received] = await Promise.all([
          query(SENT_QUERY, {
            address: normalized,
            first: limit,
          }),
          query(RECEIVED_QUERY, {
            address: normalized,
            first: limit,
          }),
        ]);

        return {
          sent: sent.transfers || [],
          received: received.transfers || [],
        };
      },
    );

    const merged = new Map(
      [...data.sent, ...data.received].map((item) => [
        String(item.id),
        item,
      ]),
    );

    const transfers = [...merged.values()]
      .map(normalizeTransfer)
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.blockNumber - a.blockNumber ||
          b.logIndex - a.logIndex,
      )
      .slice(0, limit);

    return {
      transfers,
      latestBlock: null,
      scannedFromBlock: null,
      completeHistory: true,
      indexingErrors: false,
    };
  }

  async function getTransactionTransfers(hash) {
    const normalized = normalizeTxHash(hash);

    const data = await withCache(
      `graph:tx:${normalized}`,
      30_000,
      () => query(TX_QUERY, { hash: normalized }),
    );

    return (data.transfers || [])
      .map(normalizeTransfer)
      .filter(Boolean);
  }

  async function status() {
    return withCache('graph:status', 20_000, async () => {
      const data = await query(META_QUERY);

      return {
        available: true,
        source: 'the_graph',
        sourceLabel: 'The Graph',
        indexedBlock: Number(data._meta?.block?.number || 0),
        indexingErrors: Boolean(data._meta?.hasIndexingErrors),
      };
    });
  }

  return {
    getActivity,
    getTransactionTransfers,
    status,
  };
}
