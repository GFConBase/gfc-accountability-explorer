# GFC Website Integration — Accountability Explorer

The Accountability Explorer is maintained inside the unified GFC website project while remaining modular by responsibility.

## Live public deployment

Primary demo URL:

`https://explorer.globalfoundationcoin.org/`

Integrated language routes:

- English canonical: `https://explorer.globalfoundationcoin.org/en/`
- German canonical: `https://explorer.globalfoundationcoin.org/de/`

The subdomain and main site are served from the same Netlify project. The Explorer is not maintained as a second independent production website.

## Public routes

```text
/de/
/en/
/api/explorer/*

Legacy redirects:
/de/explorer/ -> https://explorer.globalfoundationcoin.org/de/
/en/explorer/ -> https://explorer.globalfoundationcoin.org/en/
```

The production subdomain root defaults to English. Canonical language URLs are `https://explorer.globalfoundationcoin.org/en/` and `/de/`.

## Frontend

```text
/css/explorer/explorer.css
/js/explorer/explorer.js
/js/explorer/modules/*
/partials/de/explorer/explorer.html
/partials/en/explorer/explorer.html
```

The browser is read-only and talks only to same-origin `/api/explorer/*` endpoints.

## Server-side data layer

```text
/lib/explorer/
/netlify/functions/explorer-api.mjs
```

The server provider layer supports:

- The Graph as primary indexed source;
- Base Sepolia JSON-RPC as normal Explorer fallback;
- Base Sepolia Blockscout as historical transaction fallback;
- the evidence-bounded Accountability Analyst;
- published GFC Base Sepolia registry references;
- read-only Base Sepolia address classification and fail-closed GFC snapshot reads.

## The Graph

```text
/subgraph/explorer/
```

The GFC Transfer Subgraph is deployed on Base Sepolia in Subgraph Studio as:

`gfc-accountability-explorer`

Public query endpoint:

`https://api.studio.thegraph.com/query/1758809/gfc-accountability-explorer/version/latest`

The Activity Overview uses The Graph as the primary indexed source.

## AI

The live Accountability Analyst uses OpenAI server-side. `OPENAI_API_KEY` is configured only in the deployment environment and is intentionally absent from this repository.

The Analyst requires The Graph evidence and fails closed if that evidence cannot be retrieved.

## Tests

```bash
npm run test
npm run check
```

The deterministic test suite does not require public Base Sepolia availability because provider behavior is exercised against local fixtures/test servers.

## Local Explorer preview

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4173/en/
```

or:

```text
http://127.0.0.1:4173/de/
```

## Source-of-truth relationship

The production source is maintained in the unified GFC website project. This standalone ETHOnline repository mirrors the Explorer-specific source and should be synchronized at submission milestones so reviewers can inspect the Continuity work and its commit history without receiving the unrelated full website codebase.
