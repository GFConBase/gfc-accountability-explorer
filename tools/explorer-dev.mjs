import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../lib/explorer/config.js';
import { createDataProvider } from '../lib/explorer/data/provider.js';
import { createApiHandler } from '../lib/explorer/api.js';
import { createOpenAIAnalyst } from '../lib/explorer/analyst/openai.js';
import { metadataPayload, SECURITY_HEADERS } from '../lib/explorer/http.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = getConfig();
const provider = createDataProvider(config);
const analyst = createOpenAIAnalyst(config, provider);
const handleApiRequest = createApiHandler(provider, { analyst });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function writeHeaders(res, status, contentType, extra = {}) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': contentType,
    ...extra,
  });
}

function json(res, status, payload, extra = {}) {
  writeHeaders(res, status, 'application/json; charset=utf-8', { 'cache-control': 'no-store', ...extra });
  res.end(JSON.stringify(payload));
}


async function readJsonBody(req, maxBytes = 16_384) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method || '')) return null;
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('Request body is too large.');
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function safeFile(candidate) {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  return resolved === root || (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) ? resolved : null;
}

function serve(res, file) {
  const target = safeFile(file);
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) return false;
  writeHeaders(res, 200, mime[path.extname(target).toLowerCase()] || 'application/octet-stream', {
    'cache-control': path.extname(target) === '.html' ? 'no-cache' : 'public, max-age=60',
  });
  fs.createReadStream(target).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${config.host}:${config.port}`}`);
    const pathname = url.pathname;

    if (pathname === '/') {
      res.writeHead(302, { location: '/en/explorer/' });
      res.end();
      return;
    }

    if (pathname === '/en/' || pathname === '/en') {
      res.writeHead(302, { location: 'https://globalfoundationcoin.org/en/' });
      res.end();
      return;
    }

    if (pathname === '/de/' || pathname === '/de') {
      res.writeHead(302, { location: 'https://globalfoundationcoin.org/de/' });
      res.end();
      return;
    }

    if (pathname.startsWith('/api/explorer/')) {
      const route = pathname.slice('/api/explorer'.length);
      if (route === '/meta' && req.method === 'GET') {
        json(res, 200, metadataPayload());
        return;
      }
      let body = null;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        const status = error?.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
        json(res, status, { error: { code: error?.code || 'INVALID_JSON', message: error?.message || 'Invalid request body.' } });
        return;
      }
      const result = await handleApiRequest({
        method: req.method || 'GET',
        pathname: `/api${route}`,
        searchParams: url.searchParams,
        body,
        clientKey: String(req.socket.remoteAddress || 'local').slice(0, 80),
      });
      json(res, result.statusCode, result.payload, result.headers);
      return;
    }

    if (pathname === '/de/explorer/' || pathname === '/de/explorer') {
      serve(res, path.join(root, 'partials/de/explorer/explorer.html'));
      return;
    }
    if (pathname === '/en/explorer/' || pathname === '/en/explorer') {
      serve(res, path.join(root, 'partials/en/explorer/explorer.html'));
      return;
    }

    const allowedPrefixes = ['/css/explorer/', '/js/explorer/', '/img/'];
    if (allowedPrefixes.some((prefix) => pathname.startsWith(prefix)) || pathname === '/favicon.png') {
      if (serve(res, path.join(root, pathname.replace(/^\//u, '')))) return;
    }

    writeHeaders(res, 404, 'text/plain; charset=utf-8');
    res.end('Not found');
  } catch {
    json(res, 500, { error: { code: 'LOCAL_SERVER_ERROR', message: 'Local Explorer server failed.' } });
  }
});

server.listen(config.port, config.host, () => {
  console.log(`GFC Accountability Explorer (integrated): http://${config.host}:${config.port}/en/explorer/`);
  console.log(`German route: http://${config.host}:${config.port}/de/explorer/`);
  console.log(`Data source mode: ${config.mode}${config.graph.configured ? ' (The Graph configured)' : ' (The Graph not configured)'}`);
  console.log(`Accountability Analyst: ${config.analyst.configured ? `configured (${config.analyst.model})` : 'not configured'}`);
});
