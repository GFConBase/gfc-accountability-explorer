import fs from 'node:fs';
import path from 'node:path';
// Avoid import.meta.url here: Netlify may bundle server-side dependencies to CJS,
// where import.meta is unavailable. Local npm/CLI commands run from the project root,
// while deployed Functions use Netlify-provided process.env values.
const rootDir = path.resolve(process.env.GFC_PROJECT_ROOT || process.cwd());

export const NETWORK = Object.freeze({
  name: 'Base Sepolia',
  chainId: 84532,
  environment: 'testnet',
  explorerBaseUrl: 'https://sepolia.basescan.org',
  contract: '0x7262Cca91938ede6bB6560F81104Aa410848e7f3',
  token: Object.freeze({ symbol: 'tGFC', decimals: 18 }),
});

export const OFFICIAL_BASE_SEPOLIA_RPC_URLS = Object.freeze([
  'https://sepolia.base.org',
]);

// Public Subgraph Studio query endpoint for the deployed ETHOnline 2026 GFC subgraph.
// This URL contains no deploy key or API secret and can be overridden with GRAPH_STUDIO_QUERY_URL.
export const GFC_GRAPH_STUDIO_QUERY_URL =
  'https://api.studio.thegraph.com/query/1758809/gfc-accountability-explorer/version/latest';

export function loadLocalEnv(filePath = path.join(rootDir, '.env')) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    if (!/^[A-Z][A-Z0-9_]*$/u.test(key) || process.env[key] !== undefined) continue;

    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function integerEnv(name, fallback, { min, max }) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}


function enumEnv(name, fallback, allowed) {
  const value = (process.env[name] || fallback).trim().toLowerCase();
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

function validatedHost(name, fallback) {
  const value = (process.env[name] || fallback).trim();
  if (!['127.0.0.1', 'localhost', '0.0.0.0', '::1', '::'].includes(value)) {
    throw new Error(`${name} must be a supported local/bind host.`);
  }
  return value;
}

function validatedUrlValue(name, raw, { allowHttpLocalhost = false } = {}) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  const localHttp =
    allowHttpLocalhost &&
    url.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);

  if (url.protocol !== 'https:' && !localHttp) {
    throw new Error(
      `${name} must use HTTPS${allowHttpLocalhost ? ' (HTTP is allowed only for localhost)' : ''}.`,
    );
  }

  return url.toString().replace(/\/$/u, '');
}

function validatedUrl(name, fallback, options = {}) {
  return validatedUrlValue(name, process.env[name] || fallback, options);
}

function rpcUrls() {
  const explicitList = (process.env.BASE_SEPOLIA_RPC_URLS || '').trim();
  const legacySingle = (process.env.BASE_SEPOLIA_RPC_URL || '').trim();

  let candidates;
  if (explicitList) {
    candidates = explicitList.split(',').map((item) => item.trim()).filter(Boolean);
  } else if (legacySingle) {
    // Keep the explicitly configured endpoint first, then retain the official
    // Base endpoint as failover so a transient provider issue does not break reads.
    candidates = [legacySingle, ...OFFICIAL_BASE_SEPOLIA_RPC_URLS];
  } else {
    candidates = [...OFFICIAL_BASE_SEPOLIA_RPC_URLS];
  }

  const unique = [];
  const seen = new Set();
  for (const [index, candidate] of candidates.entries()) {
    const normalized = validatedUrlValue(`BASE_SEPOLIA_RPC_URLS[${index}]`, candidate, {
      allowHttpLocalhost: true,
    });
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  if (!unique.length) throw new Error('At least one Base Sepolia RPC URL is required.');
  if (unique.length > 8) throw new Error('At most 8 Base Sepolia RPC URLs are supported.');
  return Object.freeze(unique);
}

export function getConfig() {
  loadLocalEnv();

  const mode = (process.env.DATA_SOURCE_MODE || 'auto').toLowerCase();
  if (!['auto', 'graph', 'rpc'].includes(mode)) {
    throw new Error('DATA_SOURCE_MODE must be auto, graph, or rpc.');
  }

  const rawStudioQueryUrl = (process.env.GRAPH_STUDIO_QUERY_URL || GFC_GRAPH_STUDIO_QUERY_URL).trim();
  const studioQueryUrl =
    rawStudioQueryUrl && !rawStudioQueryUrl.startsWith('replace_')
      ? validatedUrl('GRAPH_STUDIO_QUERY_URL', rawStudioQueryUrl)
      : '';

  const subgraphId = (process.env.GRAPH_SUBGRAPH_ID || '').trim();
  const graphApiKey = (process.env.GRAPH_API_KEY || '').trim();

  const gatewayConfigured = Boolean(
    subgraphId &&
      graphApiKey &&
      !subgraphId.startsWith('replace_') &&
      !graphApiKey.startsWith('replace_'),
  );

  const graphConfigured = Boolean(studioQueryUrl || gatewayConfigured);
  const urls = rpcUrls();

  const openAiApiKey = (process.env.OPENAI_API_KEY || '').trim();
  const openAiModel = (process.env.OPENAI_MODEL || 'gpt-5.6-luna').trim();
  const analystConfigured = Boolean(
    openAiApiKey &&
      openAiModel &&
      !openAiApiKey.startsWith('replace_') &&
      !openAiModel.startsWith('replace_'),
  );

  return Object.freeze({
    rootDir,
    host: validatedHost('HOST', '127.0.0.1'),
    port: integerEnv('PORT', 4173, { min: 1, max: 65535 }),
    mode,
    blockscout: Object.freeze({
      apiUrl: validatedUrl('BLOCKSCOUT_API_URL', 'https://base-sepolia.blockscout.com/api/v2'),
    }),
    graph: Object.freeze({
      configured: graphConfigured,
      studioQueryUrl,
      subgraphId,
      apiKey: graphApiKey,
      gatewayUrl: validatedUrl('GRAPH_GATEWAY_URL', 'https://gateway.thegraph.com/api'),
    }),
    analyst: Object.freeze({
      configured: analystConfigured,
      apiKey: openAiApiKey,
      model: openAiModel,
      apiUrl: validatedUrl('OPENAI_API_URL', 'https://api.openai.com/v1/responses'),
      reasoningEffort: enumEnv('OPENAI_REASONING_EFFORT', 'low', ['none', 'low', 'medium', 'high', 'xhigh', 'max']),
      maxOutputTokens: integerEnv('OPENAI_MAX_OUTPUT_TOKENS', 900, { min: 200, max: 4000 }),
      timeoutMs: integerEnv('OPENAI_TIMEOUT_MS', 30000, { min: 3000, max: 120000 }),
    }),
    rpc: Object.freeze({
      urls,
      // Backwards-compatible convenience value for code/tests that only need the first endpoint.
      url: urls[0],
      lookbackBlocks: integerEnv('RPC_LOOKBACK_BLOCKS', 120000, {
        min: 1000,
        max: 2_000_000,
      }),
      chunkBlocks: integerEnv('RPC_LOG_CHUNK_BLOCKS', 10000, {
        min: 100,
        max: 100000,
      }),
      maxActivity: integerEnv('RPC_MAX_ACTIVITY', 40, {
        min: 1,
        max: 100,
      }),
    }),
    upstreamTimeoutMs: integerEnv('UPSTREAM_TIMEOUT_MS', 12000, {
      min: 1000,
      max: 60000,
    }),
  });
}
