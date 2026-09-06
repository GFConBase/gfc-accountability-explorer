import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from './config.js';
import { createDataProvider } from './data/provider.js';
import { clientKey, createRateLimiter, json, metadataPayload, parseSearchTarget, safeErrorPayload, serveStatic } from './http.js';

const config = getConfig();
const provider = createDataProvider(config);
const allowRequest = createRateLimiter({ max: 90, windowMs: 60_000 });
const builtRoot = path.join(config.rootDir, 'dist');
const staticRoot = fs.existsSync(path.join(builtRoot, 'index.html')) ? builtRoot : path.join(config.rootDir, 'web');

async function handleApi(req, res, url) {
  const key = clientKey(req);
  if (!allowRequest(key)) {
    return json(res, 429, { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } }, { 'retry-after': '60' });
  }

  try {
    if (url.pathname === '/api/meta' && req.method === 'GET') return json(res, 200, metadataPayload());
    if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, await provider.status());

    if (url.pathname === '/api/activity' && req.method === 'GET') {
      const address = url.searchParams.get('address');
      if (address && parseSearchTarget(address)?.type !== 'address') {
        return json(res, 400, { error: { code: 'INVALID_ADDRESS', message: 'Enter a valid 20-byte Ethereum address.' } });
      }
      const limit = url.searchParams.get('limit');
      return json(res, 200, await provider.activity({ address, limit }));
    }

    if (url.pathname.startsWith('/api/transaction/') && req.method === 'GET') {
      const value = decodeURIComponent(url.pathname.slice('/api/transaction/'.length));
      const target = parseSearchTarget(value);
      if (!target || target.type !== 'transaction') {
        return json(res, 400, { error: { code: 'INVALID_TRANSACTION_HASH', message: 'Enter a valid 32-byte transaction hash.' } });
      }
      const result = await provider.transaction(target.value);
      return result
        ? json(res, 200, result)
        : json(res, 404, { error: { code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found on Base Sepolia.' } });
    }

    return json(res, 404, { error: { code: 'NOT_FOUND', message: 'API route not found.' } });
  } catch (error) {
    const status = error instanceof TypeError ? 400 : 503;
    return json(res, status, safeErrorPayload(error));
  }
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `127.0.0.1:${config.port}`;
  let url;
  try {
    url = new URL(req.url || '/', `http://${host}`);
  } catch {
    return json(res, 400, { error: { code: 'BAD_REQUEST', message: 'Invalid request URL.' } });
  }

  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (!['GET', 'HEAD'].includes(req.method || '')) return json(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });

  try {
    if (!serveStatic(req, res, staticRoot, url.pathname)) {
      return json(res, 404, { error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
    }
  } catch {
    return json(res, 400, { error: { code: 'BAD_PATH', message: 'Invalid resource path.' } });
  }
});

server.listen(config.port, config.host, () => {
  const displayHost = ['0.0.0.0', '::'].includes(config.host) ? 'localhost' : config.host;
  console.log(`GFC Accountability Explorer: http://${displayHost}:${config.port}`);
  console.log(`Data source mode: ${config.mode}${config.graph.configured ? ' (The Graph configured)' : ' (The Graph not configured)'}`);
});
