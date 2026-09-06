# GFC Accountability Explorer

**ETHOnline 2026 Continuity Track build for Global Foundation Coin (GFC).**

The GFC Accountability Explorer is a new read-only Data / Analytics application that turns Base Sepolia blockchain activity into structured, human-readable **accountability evidence**.

It is deliberately not an Etherscan clone. Raw transaction fields remain visible, but the Explorer separately asks:

- **Funds** — what financial/onchain movement is actually evidenced?
- **Authority** — can authorization be established from available evidence?
- **Rules** — can the applicable rules be verified for this action?
- **Decisions** — is the underlying decision or approval evidenced?
- **Outcomes** — what technical or documented result is established?
- **Evidence** — which concrete records support the displayed claims?

The central rule is:

> **What is visible? What does it prove? What remains unproven?**

Missing evidence is reported as a limitation. The application does not infer authority, policy compliance, purpose, beneficial outcome or real-world impact from a blockchain transaction alone.

---

## Current Implementation Status

| Component | Status |
|---|---|
| Explorer web application | **Implemented** |
| Read-only Node API | **Implemented** |
| Base Sepolia transaction lookup | **Implemented** |
| Base Sepolia recent Transfer activity | **Implemented** via bounded live RPC fallback |
| Address activity filter | **Implemented** within active data-source scope |
| Transaction accountability mapping | **Implemented** |
| Verification-state UI | **Implemented** |
| The Graph client / query layer | **Implemented / requires external configuration** |
| GFC Transfer subgraph source | **Prepared / not deployed** |
| Live GFC Graph provider | **Not available in this repository state** |
| Accountability Analyst / AI | **Not implemented** |
| Wallet connection | **Not implemented by design** |
| Smart-contract writes | **Not implemented by design** |
| Base Mainnet GFC | **Not deployed** |
| GFC presale | **Not live** |

---

## Network Boundary

This Explorer is explicitly scoped to the existing public GFC testnet pilot:

| Property | Value |
|---|---|
| Environment | Public pilot / testnet |
| Network | Base Sepolia |
| Chain ID | `84532` |
| Token | `tGFC` |
| Contract | `0x7262Cca91938ede6bB6560F81104Aa410848e7f3` |
| Production status | **Non-production** |

The existing `gfc-infrastructure` repository records the official Base Mainnet GFC token as **Not Deployed**, the presale as **Not Live**, and no completed independent production security audit.

> **BASE SEPOLIA · PUBLIC PILOT · TESTNET · NOT MAINNET**

---

## ETHOnline 2026 Continuity Track

GFC existed before ETHOnline 2026.

### Pre-existing work

Pre-existing work includes the GFC project and brand, website, Transparency Portal, Base Sepolia pilot, infrastructure repository, token/economic documentation, governance and transparency documentation, roadmap, and the canonical model:

**Funds → Authority → Rules → Decisions → Outcomes → Evidence**

### New ETHOnline work

This repository contains the new Explorer application, UI, data abstraction, RPC and Graph service layer, accountability transformation logic, search/filter behavior, verification states, prepared subgraph definition, tests, and ETHOnline-specific documentation.

See [`CONTINUITY.md`](CONTINUITY.md) for the explicit boundary, including the single pre-existing brand asset reused in this application.

ETHGlobal rules require Continuity projects to disclose pre-existing work and demonstrate substantive new work during the event:
https://ethglobal.com/rules

---

## Architecture

```text
Browser (read-only)
        ↓
Explorer Node API
        ↓
  ┌──────────────────────┬─────────────────────────┐
  │ The Graph            │ Base Sepolia JSON-RPC │
  │ primary if configured│ bounded live fallback  │
  └──────────┬───────────┴────────────┬────────────┘
             ↓                        ↓
        normalized blockchain evidence
                     ↓
          accountability mapping
                     ↓
 Funds → Authority → Rules → Decisions → Outcomes → Evidence
                     ↓
             Explorer UI
```

The browser uses only same-origin `/api/*` routes. A Graph API key remains on the server and is never placed into client-side code.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Data Sources

### The Graph — primary when configured

When both `GRAPH_SUBGRAPH_ID` and `GRAPH_API_KEY` are present, the server queries The Graph Gateway using fixed GraphQL documents for:

- recent tGFC Transfer activity;
- sent / received transfers for an address;
- transfer events associated with a transaction.

The prepared custom subgraph lives in [`subgraph/`](subgraph/). It is **not deployed by this repository state**, so no Subgraph ID is invented or bundled.

### Base Sepolia JSON-RPC — live bounded fallback

With `DATA_SOURCE_MODE=auto` and no live Graph configuration, the app uses the official Base Sepolia RPC endpoint as a read-only fallback. It queries:

- current chain ID;
- current block number;
- recent `Transfer` logs for the tGFC contract;
- transaction records;
- transaction receipts;
- block timestamps.

The fallback is intentionally labeled **Recent window**. It does **not** claim complete historical indexing.

Official Base docs record Base Sepolia as chain ID `84532` and `https://sepolia.base.org` as the standard RPC endpoint:
https://docs.base.org/base-chain/api-reference/rpc-overview

---

## The Graph Readiness

The Graph is designed as a load-bearing source, not a decorative badge.

Implemented:

- server-side Graph Gateway client;
- API-key protection boundary;
- GraphQL query layer;
- normalization into the same Explorer model used by the UI;
- prepared `Transfer` subgraph schema, manifest and mapping;
- transparent Graph → RPC fallback only in `auto` mode;
- explicit source labeling in API responses and UI.

Not yet available:

- a deployed GFC Subgraph ID;
- live Graph credentials;
- a confirmed public Explorer deployment consuming that GFC subgraph.

The current official ETHOnline 2026 Continuity-specific The Graph prize is AI-oriented and requires live Graph data plus meaningful AI/agent work. This repository therefore does **not** claim final prize qualification yet. See [`docs/PRIZE-READINESS.md`](docs/PRIZE-READINESS.md).

---

## Accountability Data Model

Every domain exposes:

```text
status
summary
evidence[]
limitations[]
source
```

Supported status values:

- `verified`
- `partially_verifiable`
- `not_verifiable`
- `unavailable`

Example conservative interpretation for a successful tGFC transfer:

- Funds: the emitted amount and addresses can be verified.
- Authority: not verifiable from transaction data alone.
- Rules: not verifiable without a bound rule record.
- Decisions: not verifiable without decision evidence.
- Outcomes: technical execution is partially verifiable; broader outcomes are not.
- Evidence: the transaction/receipt/event records are verifiable within their onchain scope.

---

## Search

The search box accepts only:

- Ethereum address: `0x` + 40 hex characters;
- transaction hash: `0x` + 64 hex characters.

Address search filters activity within the scope of the active source. Transaction search loads a dedicated accountability detail view.

There is no fake search behavior and no client-side demo dataset.

---

## Setup

### Requirements

- Node.js `20` or newer
- network access to the configured live data provider for live data

The root application has **zero third-party runtime or development packages**. It uses Node and browser platform APIs directly.

### Install

```bash
npm install
```

This creates/validates the lockfile; there are no third-party packages to download for the root Explorer application.

### Development

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4173
```

Without a `.env`, the server starts in `auto` mode and attempts the official Base Sepolia read-only RPC fallback.

### Production build

```bash
npm run build
```

The build copies the small standards-based web application into `dist/` and rejects unsafe inline script/event patterns.

### Start built application

```bash
npm start
```

If `dist/index.html` exists, the server serves the build output. Otherwise it serves `web/` for development.

---

## Tests and Checks

```bash
npm run lint
npm test
npm run build
npm run security:check
npm run check
```

Coverage includes:

- address validation;
- transaction-hash validation;
- query-limit validation;
- empty data;
- malformed numeric input;
- accountability verification-state logic;
- non-inference of authority/rules/decisions;
- reverted transaction handling;
- exact integer token formatting;
- indexed address-topic parsing;
- safe error responses;
- rate limiting;
- RPC-format integration using clearly isolated test fixtures.

`TEST FIXTURE` data exists only inside tests and is never presented by the application as live data.

---

## Environment Variables

Copy `.env.example` to `.env` locally when needed. Real `.env` files are ignored by Git.

| Variable | Purpose | Default |
|---|---|---|
| `HOST` | Bind host; loopback by default | `127.0.0.1` |
| `PORT` | Local server port | `4173` |
| `DATA_SOURCE_MODE` | `auto`, `graph`, or `rpc` | `auto` |
| `GRAPH_SUBGRAPH_ID` | Deployed GFC subgraph identifier | none |
| `GRAPH_API_KEY` | Server-side Graph Gateway key | none |
| `GRAPH_GATEWAY_URL` | Graph Gateway base URL | `https://gateway.thegraph.com/api` |
| `BASE_SEPOLIA_RPC_URL` | Read-only Base Sepolia RPC | `https://sepolia.base.org` |
| `RPC_LOOKBACK_BLOCKS` | Recent-window fallback depth | `120000` |
| `RPC_LOG_CHUNK_BLOCKS` | RPC log scan chunk size | `10000` |
| `RPC_MAX_ACTIVITY` | RPC activity result cap | `40` |
| `UPSTREAM_TIMEOUT_MS` | Upstream timeout | `12000` |

`GRAPH_API_KEY` is server-side only and must never be exposed in browser code.

---

## Deployment

This repository does not claim an ETHOnline public deployment yet.

The app can be deployed to a Node 20-compatible host that:

1. runs `npm run build`;
2. sets `HOST=0.0.0.0` only if the hosting platform requires an external bind;
3. runs `npm start`;
4. stores Graph credentials as server-side environment secrets if The Graph is enabled;
5. exposes the server over HTTPS.

A public deployment URL should be added only after it actually exists.

---

## Security

The Explorer is intentionally read-only:

- no wallet connection;
- no private keys;
- no signatures;
- no token approvals;
- no token transfers;
- no smart-contract writes;
- no client-side secrets;
- no arbitrary GraphQL proxy;
- no dynamic code execution.

Additional controls include CSP/security headers, safe DOM text handling, fixed external link origins, validation, request timeouts, caching, request deduplication and basic rate limiting.

See [`SECURITY.md`](SECURITY.md).

**Source verification is not a security audit.** The public Base Sepolia pilot must not be represented as audited merely because its source is verified.

---

## Limitations

Current known limitations are explicit rather than hidden:

- no deployed GFC subgraph is authenticated in this repository state;
- Graph live mode requires an external Subgraph ID and server-side API key;
- RPC fallback is a bounded recent window, not full historical indexing;
- transaction metadata currently uses Base Sepolia RPC even when Graph supplies indexed tGFC Transfer entities;
- no offchain evidence store currently binds a transaction to authority, rules, decisions, outcomes or impact;
- no Accountability Analyst is implemented yet;
- no Mainnet functionality is represented;
- live provider availability depends on external network/provider availability.

---

## AI Assistance Disclosure

ChatGPT is used for:

- coding;
- troubleshooting;
- translation.

Product direction, scope, integration decisions, testing, verification and deployment remain founder-directed. AI assistance is not represented as the project owner or as autonomous control of GFC.

The Explorer itself currently contains **no AI analyst feature**.

---

## Repository Hygiene

The repository excludes:

- `node_modules`;
- generated `dist/` output;
- `.env` secrets;
- logs;
- temporary files;
- local test reports;
- IDE / OS metadata;
- ZIP backups.

---

## Related GFC Links

- Website: https://globalfoundationcoin.org/
- Existing infrastructure: https://github.com/GFConBase/gfc-infrastructure
- Explorer repository: https://github.com/GFConBase/gfc-accountability-explorer
- GitHub organization: https://github.com/GFConBase
- Base Sepolia pilot: https://sepolia.basescan.org/address/0x7262Cca91938ede6bB6560F81104Aa410848e7f3

---

## License

MIT License.

Copyright (c) 2026 Raphael Franken / Global Foundation Coin
