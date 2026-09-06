import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export const NETWORK = Object.freeze({
  name: 'Base Sepolia',
  chainId: 84532,
  environment: 'testnet',
  explorerBaseUrl: 'https://sepolia.basescan.org',
  contract: '0x7262Cca91938ede6bB6560F81104Aa410848e7f3',
  token: Object.freeze({ symbol: 'tGFC', decimals: 18 }),
});

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

function validatedHost(name, fallback) {
  const value = (process.env[name] || fallback).trim();
  if (!['127.0.0.1', 'localhost', '0.0.0.0', '::1', '::'].includes(value)) {
    throw new Error(`${name} must be a supported local/bind host.`);
  }
  return value;
}

function validatedUrl(name, fallback, { allowHttpLocalhost = false } = {}) {
  const raw = process.env[name] || fallback;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  const localHttp = allowHttpLocalhost && url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) {
    throw new Error(`${name} must use HTTPS${allowHttpLocalhost ? ' (HTTP is allowed only for localhost)' : ''}.`);
  }
  return url.toString().replace(/\/$/u, '');
}

export function getConfig() {
  loadLocalEnv();

  const mode = (process.env.DATA_SOURCE_MODE || 'auto').toLowerCase();
  if (!['auto', 'graph', 'rpc'].includes(mode)) {
    throw new Error('DATA_SOURCE_MODE must be auto, graph, or rpc.');
  }

  const subgraphId = (process.env.GRAPH_SUBGRAPH_ID || '').trim();
  const graphApiKey = (process.env.GRAPH_API_KEY || '').trim();
  const graphConfigured = Boolean(subgraphId && graphApiKey && !subgraphId.startsWith('replace_') && !graphApiKey.startsWith('replace_'));

  return Object.freeze({
    rootDir,
    host: validatedHost('HOST', '127.0.0.1'),
    port: integerEnv('PORT', 4173, { min: 1, max: 65535 }),
    mode,
    graph: Object.freeze({
      configured: graphConfigured,
      subgraphId,
      apiKey: graphApiKey,
      gatewayUrl: validatedUrl('GRAPH_GATEWAY_URL', 'https://gateway.thegraph.com/api'),
    }),
    rpc: Object.freeze({
      url: validatedUrl('BASE_SEPOLIA_RPC_URL', 'https://sepolia.base.org', { allowHttpLocalhost: true }),
      lookbackBlocks: integerEnv('RPC_LOOKBACK_BLOCKS', 120000, { min: 1000, max: 2_000_000 }),
      chunkBlocks: integerEnv('RPC_LOG_CHUNK_BLOCKS', 10000, { min: 100, max: 100000 }),
      maxActivity: integerEnv('RPC_MAX_ACTIVITY', 40, { min: 1, max: 100 }),
    }),
    upstreamTimeoutMs: integerEnv('UPSTREAM_TIMEOUT_MS', 12000, { min: 1000, max: 60000 }),
  });
}
