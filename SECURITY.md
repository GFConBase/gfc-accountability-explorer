# Security

## Scope

This repository contains the read-only GFC Accountability Explorer for a public Base Sepolia pilot. It is not a wallet, custody system, token-sale interface, transaction signer, contract administrator, or production governance system.

## Deliberate security constraints

The application does not ask users to:

- connect a wallet;
- sign a message;
- sign a transaction;
- approve token spending;
- transfer funds;
- provide a private key or seed phrase;
- execute a smart-contract write.

Any future feature that introduces those capabilities creates a new security boundary and should receive separate review before release.

## Browser / server boundary

Browser code lives under:

```text
/js/explorer/
/partials/{de,en}/explorer/
/css/explorer/
```

Secret-bearing and provider-sensitive logic lives under:

```text
/lib/explorer/
/netlify/functions/explorer-api.mjs
```

The browser calls same-origin `/api/explorer/*` routes. It does not receive an OpenAI API key or optional Graph Gateway API key.

## Data-provider trust boundaries

### The Graph

The Graph is the primary indexed tGFC / Transfer-event evidence source.

The application uses fixed GraphQL documents and normalizes returned values before they reach the accountability model.

### Base Sepolia JSON-RPC

The RPC client:

- accepts HTTPS endpoints, with HTTP allowed only for localhost testing;
- checks `eth_chainId`;
- requires Base Sepolia chain ID `84532`;
- uses finite timeouts;
- supports endpoint failover;
- bounds recent log scans.

### Base Sepolia Blockscout

Blockscout may be used when historical transaction metadata is unavailable from the configured RPC.

Blockscout evidence is labeled as **secondary indexed historical transaction metadata**. It must not be represented as:

- a direct JSON-RPC receipt;
- data supplied by The Graph;
- proof of organizational authority or policy compliance.

## Accountability Analyst boundary

The Analyst requires a fresh server-side evidence packet from The Graph.

For transaction scope, the packet may contain explicitly labeled Blockscout metadata as a secondary source.

The Analyst:

- fails closed when required Graph evidence is unavailable;
- cannot upgrade deterministic verification states;
- cannot infer missing governance/offchain facts;
- must preserve source provenance;
- treats transaction `from` as transaction sender, not organizational authority;
- must not equate ERC-20 `Transfer.from` with transaction sender without evidence;
- receives normalized token amounts and must not decimal-convert them again;
- uses structured output;
- sends OpenAI Responses requests with `store: false`.

The AI is explanatory only and is not itself an evidence source.

## Secrets

Real secrets must never be committed.

Examples:

- `OPENAI_API_KEY`
- `GRAPH_API_KEY`
- private keys
- seed phrases
- deployment credentials

Use `.env.example` as a template. Keep `.env` local or use the deployment platform's secret store.

The public Subgraph Studio query URL is not treated as a secret.

## Application controls

Current controls include:

- strict Ethereum address and transaction-hash validation;
- fixed GraphQL documents;
- request rate limiting;
- bounded result limits;
- upstream timeouts;
- RPC chain-ID validation and failover;
- in-memory request cache/deduplication;
- safe production error messages;
- same-origin API boundary;
- restrictive CSP/security headers;
- safe DOM construction;
- fixed/validated external explorer URLs;
- `noopener noreferrer` on new-tab links.

## Status language

Source verification is not a security audit.

The current tGFC deployment is a public **Base Sepolia testnet pilot**. This repository does not claim:

- a live Base Mainnet GFC token;
- a live presale;
- a completed independent production security audit;
- production governance;
- a production offchain evidence registry.

## Reporting

Do not place secrets or private security material in a public issue. Use the official GFC contact channel published at https://globalfoundationcoin.org/ for sensitive reports.
