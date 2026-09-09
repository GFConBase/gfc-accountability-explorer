import fs from 'node:fs';
import path from 'node:path';
import { NETWORK } from './config.js';
import { isAddress, isTxHash } from './validation.js';

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
});

export const SECURITY_HEADERS = Object.freeze({
  'content-security-policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; upgrade-insecure-requests",
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
});

function setSecurityHeaders(res) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
}

export function json(res, statusCode, payload, extraHeaders = {}) {
  setSecurityHeaders(res);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

export function safeErrorPayload(error) {
  const code = typeof error?.code === 'string' ? error.code : 'REQUEST_FAILED';
  const allowedMessages = new Map([
    ['GRAPH_NOT_CONFIGURED', 'The Graph data source is not configured.'],
    ['GRAPH_UNAVAILABLE', 'The Graph data source is currently unavailable.'],
    ['RPC_UNAVAILABLE', 'Base Sepolia RPC is currently unavailable.'],
    ['RPC_WRONG_NETWORK', 'The configured RPC endpoints are not serving Base Sepolia.'],
    ['ANALYST_NOT_CONFIGURED', 'The Accountability Analyst is not configured.'],
    ['ANALYST_UNAVAILABLE', 'The Accountability Analyst is currently unavailable.'],
    ['GRAPH_REQUIRED_FOR_ANALYST', 'The Accountability Analyst requires live indexed data from The Graph.'],
    ['GFC_REGISTRY_UNAVAILABLE', 'The published GFC Base Sepolia registry is currently unavailable.'],
  ]);
  return { error: { code, message: allowedMessages.get(code) || 'The request could not be completed.' } };
}

export function createRateLimiter({ windowMs = 60_000, max = 90 } = {}) {
  const buckets = new Map();
  return function allow(key) {
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    current.count += 1;
    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    return current.count <= max;
  };
}

export function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim().slice(0, 80);
  return String(req.socket.remoteAddress || 'unknown').slice(0, 80);
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return target === root || (Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative));
}

export function serveStatic(req, res, staticRoot, pathname) {
  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const decoded = decodeURIComponent(requestPath);
  if (decoded.includes('\0')) return false;
  const candidate = path.resolve(staticRoot, `.${decoded}`);
  if (!isInside(staticRoot, candidate)) return false;

  let filePath = candidate;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (path.extname(decoded)) return false;
    filePath = path.join(staticRoot, 'index.html');
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;

  setSecurityHeaders(res);
  const extension = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[extension] || 'application/octet-stream',
    'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=300',
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  fs.createReadStream(filePath).pipe(res);
  return true;
}

export function parseSearchTarget(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > 66) return null;
  if (isAddress(trimmed)) return { type: 'address', value: trimmed.toLowerCase() };
  if (isTxHash(trimmed)) return { type: 'transaction', value: trimmed.toLowerCase() };
  return null;
}

export function metadataPayload() {
  return {
    project: 'GFC Accountability Explorer',
    network: NETWORK.name,
    chainId: NETWORK.chainId,
    contract: NETWORK.contract,
    environment: 'PUBLIC PILOT / TESTNET / NOT MAINNET',
    readOnly: true,
    walletConnection: false,
    mainnet: false,
  };
}
