# Deployment

## Current public deployment

- Main GFC site: `https://globalfoundationcoin.org/`
- Explorer subdomain: `https://explorer.globalfoundationcoin.org/`
- English integrated route: `https://globalfoundationcoin.org/en/explorer/`
- German integrated route: `https://globalfoundationcoin.org/de/explorer/`

The production Explorer is deployed from the unified GFC website project to the same Netlify site as the main website.

## Production environment

Server-side deployment variables include:

```text
DATA_SOURCE_MODE=auto
GRAPH_STUDIO_QUERY_URL=https://api.studio.thegraph.com/query/1758809/gfc-accountability-explorer/version/latest
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=low
```

`OPENAI_API_KEY` is a secret and is intentionally not present in this repository.

Existing non-Explorer GFC environment variables belong to the unified website deployment and are outside this standalone repository's scope.

## Subdomain

The public subdomain uses DNS:

```text
explorer CNAME keen-choux-efe88a.netlify.app
```

and is attached as a domain alias to the existing GFC Netlify site. TLS is provided by Netlify/Let's Encrypt.

The production `_redirects` configuration internally rewrites the subdomain root to the English Explorer page while preserving the clean browser URL.

## Deployment principle

The standalone ETHOnline repository is **not** a second production source of truth.

Production changes should be made in the unified GFC website project, tested in a Netlify draft deploy, promoted to production, and then synchronized back into this standalone repository for Continuity review.
