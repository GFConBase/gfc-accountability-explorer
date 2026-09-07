import { getConfig } from '../../lib/explorer/config.js';
import { createDataProvider } from '../../lib/explorer/data/provider.js';
import { createApiHandler } from '../../lib/explorer/api.js';
import { createOpenAIAnalyst } from '../../lib/explorer/analyst/openai.js';
import { metadataPayload, SECURITY_HEADERS } from '../../lib/explorer/http.js';

const config = getConfig();
const provider = createDataProvider(config);
const analyst = createOpenAIAnalyst(config, provider);
const handleApiRequest = createApiHandler(provider, { analyst });

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...SECURITY_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

function normalizeRoute(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/gu, '');
}

function routeFromPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let pathname = raw;
  try {
    if (/^https?:\/\//iu.test(raw)) pathname = new URL(raw).pathname;
  } catch {
    pathname = raw;
  }

  const publicPrefix = '/api/explorer/';
  const functionPrefix = '/.netlify/functions/explorer-api/';

  if (pathname.startsWith(publicPrefix)) {
    return normalizeRoute(pathname.slice(publicPrefix.length));
  }

  if (pathname.startsWith(functionPrefix)) {
    return normalizeRoute(pathname.slice(functionPrefix.length));
  }

  return '';
}

function resolveRoute(event) {
  const explicitRoute = normalizeRoute(event.queryStringParameters?.route);
  if (explicitRoute) return explicitRoute;

  // Netlify rewrites can vary in which request fields retain the original path.
  // Fall back to the public request path / raw URL instead of silently routing
  // to `/api/` when the injected `route` query parameter is unavailable.
  const candidates = [
    event.path,
    event.rawUrl,
    event.headers?.['x-forwarded-uri'],
    event.headers?.['x-original-uri'],
  ];

  for (const candidate of candidates) {
    const route = routeFromPath(candidate);
    if (route) return route;
  }

  return '';
}

export async function handler(event) {
  const route = resolveRoute(event);
  const pathname = `/api/${route}`;

  if (pathname === '/api/meta' && event.httpMethod === 'GET') {
    return json(200, metadataPayload());
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(event.queryStringParameters || {})) {
    if (key === 'route' || value === undefined || value === null) continue;
    params.set(key, String(value));
  }

  let body = null;
  if (event.body) {
    try {
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : String(event.body);
      if (Buffer.byteLength(rawBody, 'utf8') > 16_384) {
        return json(413, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
      }
      body = JSON.parse(rawBody);
    } catch {
      return json(400, { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
    }
  }

  const forwarded = event.headers?.['x-forwarded-for'] || event.headers?.['client-ip'] || 'netlify';
  const result = await handleApiRequest({
    method: event.httpMethod || 'GET',
    pathname,
    searchParams: params,
    body,
    clientKey: String(forwarded).split(',')[0].trim().slice(0, 80),
  });

  return json(result.statusCode, result.payload, result.headers);
}
