import { createRateLimiter, parseSearchTarget, safeErrorPayload } from './http.js';

function response(statusCode, payload, headers = {}) {
  return { statusCode, payload, headers };
}

function safeDecodePathValue(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return null;
  }
}

export function createApiHandler(provider, { analyst = null, maxRequests = 90, windowMs = 60_000, analystMaxRequests = 12 } = {}) {
  const allowRequest = createRateLimiter({ max: maxRequests, windowMs });
  const allowAnalystRequest = createRateLimiter({ max: analystMaxRequests, windowMs });

  return async function handleApiRequest({ method = 'GET', pathname, searchParams, body = null, clientKey = 'unknown' }) {
    if (!allowRequest(clientKey)) {
      return response(
        429,
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } },
        { 'retry-after': '60' },
      );
    }

    try {
      if (pathname === '/api/status' && method === 'GET') {
        const status = await provider.status();
        return response(200, {
          ...status,
          analyst: analyst?.status ? analyst.status() : { configured: false, available: false, graphRequired: true },
        });
      }

      if (pathname === '/api/activity' && method === 'GET') {
        const address = searchParams.get('address');
        if (address && parseSearchTarget(address)?.type !== 'address') {
          return response(400, {
            error: { code: 'INVALID_ADDRESS', message: 'Enter a valid 20-byte Ethereum address.' },
          });
        }

        return response(200, await provider.activity({
          address,
          limit: searchParams.get('limit'),
        }));
      }

      if (pathname === '/api/gfc/references' && method === 'GET') {
        return response(200, provider.references());
      }

      if (pathname === '/api/gfc/snapshot' && method === 'GET') {
        return response(200, await provider.gfcSnapshot());
      }

      if (pathname.startsWith('/api/gfc/reference/') && method === 'GET') {
        const value = safeDecodePathValue(pathname.slice('/api/gfc/reference/'.length));
        if (!value || value.length > 100) {
          return response(400, { error: { code: 'INVALID_REFERENCE', message: 'Enter a valid published GFC reference id or address.' } });
        }
        const result = provider.reference(value);
        return result
          ? response(200, result)
          : response(404, { error: { code: 'REFERENCE_NOT_FOUND', message: 'Published GFC reference not found.' } });
      }

      if (pathname.startsWith('/api/address/') && method === 'GET') {
        const value = safeDecodePathValue(pathname.slice('/api/address/'.length));
        const target = value ? parseSearchTarget(value) : null;
        if (!target || target.type !== 'address') {
          return response(400, { error: { code: 'INVALID_ADDRESS', message: 'Enter a valid 20-byte Ethereum address.' } });
        }
        return response(200, await provider.address(target.value));
      }

      if (pathname === '/api/analyst' && method === 'POST') {
        if (!allowAnalystRequest(clientKey)) {
          return response(
            429,
            { error: { code: 'ANALYST_RATE_LIMITED', message: 'Too many analyst requests. Try again shortly.' } },
            { 'retry-after': '60' },
          );
        }

        if (!analyst?.analyze) {
          return response(503, {
            error: { code: 'ANALYST_NOT_CONFIGURED', message: 'The Accountability Analyst is not configured.' },
          });
        }

        const question = typeof body?.question === 'string' ? body.question.trim() : '';
        const scope = typeof body?.scope === 'string' ? body.scope.trim().toLowerCase() : 'recent';
        const target = typeof body?.target === 'string' ? body.target.trim() : null;
        const locale = body?.locale === 'de' ? 'de' : 'en';

        if (question.length < 3 || question.length > 600) {
          return response(400, {
            error: { code: 'INVALID_ANALYST_QUESTION', message: 'Question must be between 3 and 600 characters.' },
          });
        }

        if (!['recent', 'address', 'transaction'].includes(scope)) {
          return response(400, {
            error: { code: 'INVALID_ANALYST_SCOPE', message: 'Analyst scope must be recent, address, or transaction.' },
          });
        }

        if (scope === 'address' && parseSearchTarget(target)?.type !== 'address') {
          return response(400, {
            error: { code: 'INVALID_ADDRESS', message: 'Enter a valid 20-byte Ethereum address.' },
          });
        }

        if (scope === 'transaction' && parseSearchTarget(target)?.type !== 'transaction') {
          return response(400, {
            error: { code: 'INVALID_TRANSACTION_HASH', message: 'Enter a valid 32-byte transaction hash.' },
          });
        }

        return response(200, await analyst.analyze({ question, scope, target, locale }));
      }

      if (pathname.startsWith('/api/transaction/') && method === 'GET') {
        const value = safeDecodePathValue(pathname.slice('/api/transaction/'.length));
        const target = value ? parseSearchTarget(value) : null;
        if (!target || target.type !== 'transaction') {
          return response(400, {
            error: { code: 'INVALID_TRANSACTION_HASH', message: 'Enter a valid 32-byte transaction hash.' },
          });
        }

        const result = await provider.transaction(target.value);
        return result
          ? response(200, result)
          : response(404, {
              error: { code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found on Base Sepolia.' },
            });
      }

      return response(404, { error: { code: 'NOT_FOUND', message: 'API route not found.' } });
    } catch (error) {
      const statusCode = error instanceof TypeError ? 400 : 503;
      return response(statusCode, safeErrorPayload(error));
    }
  };
}
