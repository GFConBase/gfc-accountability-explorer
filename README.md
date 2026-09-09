# GFC Accountability Explorer

**ETHOnline 2026 Continuity build for Global Foundation Coin (GFC).**

**Live demo:** https://explorer.globalfoundationcoin.org/

The GFC Accountability Explorer is a read-only Data / Analytics application that turns Base Sepolia activity into structured, human-readable accountability evidence. It is not an Etherscan clone: the interface separates what is visible onchain from what that evidence actually proves, and from what remains unverified.

> **What is visible? What does it prove? What remains unproven?**

The deterministic evidence model is:

**Funds → Authority → Rules → Decisions → Outcomes → Evidence**

Missing evidence is displayed as a limitation. Transaction execution is never silently converted into proof of organizational authority, policy compliance, decision rationale, beneficial outcome, or real-world impact.

---

## Public status

| Component | Status |
|---|---|
| Public Explorer | **Live** |
| Production demo URL | **https://explorer.globalfoundationcoin.org/** |
| English canonical route | **https://explorer.globalfoundationcoin.org/en/** |
| German canonical route | **https://explorer.globalfoundationcoin.org/de/** |
| Base Sepolia transaction lookup | **Live** |
| Indexed Transfer activity | **Live via The Graph** |
| Address activity | **Live via The Graph for tGFC activity + Base Sepolia RPC classification** |
| Published GFC references | **Integrated from the Base Sepolia registry** |
| GFC live snapshot | **Read-only Base Sepolia RPC; unavailable reads stay unavailable** |
| Historical transaction fallback | **Live via Base Sepolia Blockscout when required** |
| Accountability transformation model | **Implemented** |
| Accountability Analyst / AI | **Live when server-side OpenAI key is configured** |
| GFC Transfer Subgraph | **Deployed on Base Sepolia** |
| The Graph as primary indexed source | **Live** |
| Wallet connection | **Not implemented by design** |
| Contract writes | **Not implemented by design** |
| Base Mainnet GFC | **Not deployed** |
| GFC presale | **Not live** |

The production deployment is integrated into the main GFC website project. This standalone repository is the ETHOnline review/synchronization repository for the Explorer-specific source, Continuity disclosure, tests and commit history.

---

## Network boundary

This build is scoped to the existing public GFC testnet pilot:

| Property | Value |
|---|---|
| Environment | Public pilot / testnet |
| Network | Base Sepolia |
| Chain ID | `84532` |
| Token | `tGFC` |
| Contract | `0x7262Cca91938ede6bB6560F81104Aa410848e7f3` |
| Production status | **Non-production** |

**BASE SEPOLIA · PUBLIC PILOT · TESTNET · NOT MAINNET**

Source verification of pilot code is not an independent security audit and does not establish production readiness.

---

## Live data architecture

```text
Browser (read-only)
        |
        v
same-origin /api/explorer/*
        |
        v
server-side provider layer
   /          |             \
  v           v              v
The Graph   Base RPC     Blockscout
primary     fallback     historical tx fallback
  \           |              /
   +----------+-------------+
              |
              v
normalized evidence
              |
              v
deterministic accountability mapping
              |
              v
Funds / Authority / Rules / Decisions / Outcomes / Evidence
```

### The Graph

The deployed Subgraph Studio project is:

`gfc-accountability-explorer`

Public Studio query endpoint:

`https://api.studio.thegraph.com/query/1758809/gfc-accountability-explorer/version/latest`

The Graph is the primary indexed source for tGFC `Transfer` activity. The Activity Overview, address scope and transaction-event lookup consume that indexed data.

### Base Sepolia JSON-RPC

The normal Explorer can use read-only Base Sepolia JSON-RPC as a bounded fallback. The client validates chain ID `84532`, supports endpoint failover, finite timeouts and bounded log windows.

### Base Sepolia Blockscout

When a public RPC cannot serve an older transaction-by-hash lookup, transaction detail may use Base Sepolia Blockscout as **secondary indexed historical transaction metadata**.

That provenance remains distinct from:

- The Graph indexed Transfer-event evidence;
- direct JSON-RPC transaction/receipt evidence.

### Published GFC references and snapshot

The Explorer can expose known GFC Base Sepolia contracts and the fixed test-treasury reference from the synchronized registry at `contracts/base-sepolia/registry.json`. The three registry-linked contract manifests are mirrored alongside it so reference detail can expose deployment, compiler, control, capability and configured-read metadata without inventing those fields. These files are **pre-existing GFC source data**; the ETHOnline Explorer integration is the new investigation surface around them.

Read-only routes include:

- `/api/explorer/gfc/references`;
- `/api/explorer/gfc/reference/:id-or-address`;
- `/api/explorer/address/:address`;
- `/api/explorer/gfc/snapshot`.

Live RPC fields fail closed: an unavailable read remains `null`/unavailable and is never reconstructed from a static claim. The registry also preserves the public boundary that no official GFC mainnet contracts, active public mainnet presale or external audit report are published in this testnet state.

---

## Accountability Analyst

The Accountability Analyst is the ETHOnline Continuity AI feature.

For every Analyst request:

1. the server validates the requested scope;
2. The Graph is queried server-side for a fresh indexed tGFC evidence packet;
3. for transaction scope, Blockscout may supplement the packet with explicitly labeled secondary transaction metadata;
4. the bounded packet and user question are sent to the configured AI provider;
5. structured output is returned as:
   - answer;
   - verified facts;
   - limitations;
   - cannot-conclude statements;
   - evidence scope.

The Graph is **load-bearing** for this feature. If the required Graph evidence cannot be obtained, the Analyst fails closed. It does not substitute RPC-only, Blockscout-only, static or mock evidence.

The AI is explanatory only and cannot alter the deterministic verification states.

See [`docs/explorer/AI-ANALYST.md`](docs/explorer/AI-ANALYST.md).

---

## Provenance rules

The implementation deliberately keeps the following distinctions:

- **The Graph** — primary indexed tGFC activity and Transfer-event evidence.
- **Base Sepolia Blockscout** — secondary indexed historical transaction metadata when used.
- **Base Sepolia JSON-RPC** — direct read-only RPC evidence when the provider serves it.
- **AI model** — explanatory only; never an evidence source.
- **Deterministic accountability model** — authoritative for verification states.

A transaction `from` field is described as the **transaction sender**. It is not treated as proof of organizational authority. An ERC-20 `Transfer.from` address is not automatically assumed to equal the transaction sender.

Token amounts sent to the Analyst are already normalized to human-readable token units and must not be decimal-converted again.

---

## Real demo transaction

A public Base Sepolia transaction used in the live demo:

`0x2afbe77b1d4141cdcc900645a85afb19a319508621da12606541e7a1cb0c56a8`

Indexed tGFC Transfer evidence:

- amount: `150000000 tGFC`
- from: `0xed17f3a500f8d7c23cfd5c6e8782f4bd914e4280`
- to: `0xd03ebb0c507fe55f6b5f9a79076d8ec259b47399`
- block: `44955007`

The current deterministic interpretation is intentionally conservative:

| Domain | State |
|---|---|
| Funds | **Verified** |
| Authority | **Not verifiable** |
| Rules | **Not verifiable** |
| Decisions | **Not verifiable** |
| Outcomes | **Partially verifiable** |
| Evidence | **Verified** |

---

## Repository layout

```text
css/explorer/                         Explorer styles
js/explorer/                          browser controller + modules
partials/de/explorer/                 German Explorer page
partials/en/explorer/                 English Explorer page
lib/explorer/                         server-side provider/model/API logic
lib/explorer/analyst/                 evidence-bounded AI layer
netlify/functions/explorer-api.mjs    Netlify API adapter
subgraph/explorer/                    deployed GFC Transfer Subgraph source
tests/explorer/                       deterministic tests
tools/explorer-dev.mjs                local Explorer server
docs/explorer/                        architecture/security/Continuity docs
```

This layout intentionally mirrors the Explorer-specific structure in the unified GFC website project so synchronization can be reviewed file-for-file.

---

## Local development

### Requirements

- Node.js `20` or newer
- network access for live provider calls

The Explorer runtime uses Node/browser platform APIs directly and has no third-party root runtime dependency.

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173/en/
```

German:

```text
http://127.0.0.1:4173/de/
```

The public The Graph Studio endpoint is already the default indexed source. The AI feature requires a local server-side OpenAI key.

---

## Environment

Copy:

```text
.env.example
```

to:

```text
.env
```

for local-only configuration.

Relevant values:

```env
DATA_SOURCE_MODE=auto
GRAPH_STUDIO_QUERY_URL=https://api.studio.thegraph.com/query/1758809/gfc-accountability-explorer/version/latest

OPENAI_API_KEY=replace_with_server_side_key
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=low
```

Never commit a real `.env`, OpenAI key, Graph Gateway key, private key or wallet secret.

See [`EXPLORER-ENVIRONMENT-VARIABLES.txt`](EXPLORER-ENVIRONMENT-VARIABLES.txt).

---

## Verification

Run:

```bash
npm run check
```

The final synchronized repository includes the production Explorer test suite covering:

- deterministic accountability states;
- The Graph provider behavior;
- Graph-required Analyst behavior;
- The Graph / Blockscout provenance boundary;
- normalized token amount handling;
- Base Sepolia RPC failover and wrong-chain rejection;
- Blockscout historical transaction fallback;
- public API input validation;
- rate limiting and safe error payloads;
- Netlify adapter routing;
- DE/EN frontend integration;
- canonical Explorer-subdomain routing and legacy redirects;
- published GFC reference lookup and address classification;
- fail-closed GFC snapshot mapping and malformed-route regression coverage.

**Current synchronized result: 40/40 tests pass.**

---

## ETHOnline 2026 Continuity disclosure

GFC existed before ETHOnline 2026.

Pre-existing GFC work includes the project and brand, main website, Transparency Portal, public Base Sepolia pilot, infrastructure repository, token/economic documentation, governance/transparency documentation, roadmap and the canonical accountability model.

The Explorer, its live data layer, custom Transfer Subgraph integration, evidence transformation, verification UI and Accountability Analyst are the substantive ETHOnline Continuity work documented in this repository.

See [`CONTINUITY.md`](CONTINUITY.md).

---

## Security

The Explorer is intentionally read-only:

- no wallet connection;
- no signatures;
- no approvals;
- no token transfers;
- no private keys;
- no contract writes;
- same-origin browser API;
- server-only secrets;
- fixed GraphQL documents;
- input validation;
- rate limiting;
- upstream timeouts;
- restrictive security headers;
- structured AI output;
- `store: false` for OpenAI Responses requests.

See [`SECURITY.md`](SECURITY.md).

---

## Related GFC repositories

- GFC infrastructure: https://github.com/GFConBase/gfc-infrastructure
- ETHOnline Explorer: https://github.com/GFConBase/gfc-accountability-explorer
- GFC website: https://globalfoundationcoin.org/

## License

MIT. See [`LICENSE`](LICENSE).
