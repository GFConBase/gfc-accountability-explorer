# GFC Accountability Explorer Architecture

## Synchronized production layout

```text
/css/explorer/                         Explorer styles
/js/explorer/                          browser controller + modules
/partials/de/explorer/explorer.html    German Explorer page
/partials/en/explorer/explorer.html    English Explorer page
/lib/explorer/                         server-side provider/model/API logic
/lib/explorer/analyst/                 evidence-bounded AI layer
/netlify/functions/explorer-api.mjs    Netlify same-origin API adapter
/subgraph/explorer/                    GFC Transfer Subgraph source
/tests/explorer/                       deterministic tests
/docs/explorer/                        architecture/continuity/security docs
```

This standalone repository mirrors the Explorer-specific production layout used inside the unified GFC website project. Browser code and secret-bearing server code remain separated.

## Runtime data flow

```text
                         +---------------------------+
                         |  Deployed GFC Subgraph    |
                         |  Base Sepolia / The Graph |
                         +-------------+-------------+
                                       |
                                  live indexed data
                                       |
                                       v
Browser (read-only) ---> same-origin /api/explorer/* ---> Server provider layer
       |                                               /       |        \
       |                                              /        |         \
       |                                             v         v          v
       |                                      The Graph    Base RPC   Blockscout
       |                                      primary      fallback   historical tx
       |                                             \         |          /
       |                                              +--------+---------+
       |                                                       |
       |                                                       v
       |                                             deterministic mapping
       |                                                       |
       |                                                       v
       |                                Funds / Authority / Rules / Decisions /
       |                                      Outcomes / Evidence states
       |                                                       |
       +-------------------------------------------------------+

Natural-language Analyst request
       |
       v
POST /api/explorer/analyst
       |
       v
The Graph REQUIRED (load-bearing primary indexed tGFC evidence)
       |
       v
bounded server-side evidence packet
       |
       +--> optional Base Sepolia Blockscout
       |    secondary indexed historical transaction metadata
       |
       v
OpenAI Responses API (structured output, store:false)
       |
       v
answer + verified facts + limitations + cannot-conclude list
```

## The Graph architecture

The GFC Subgraph is deployed on **Base Sepolia** and indexes `Transfer` events emitted by the tGFC pilot contract.

The public Subgraph Studio query endpoint is the default indexed source. It can be overridden using `GRAPH_STUDIO_QUERY_URL`, or replaced later with a Graph Gateway configuration using `GRAPH_SUBGRAPH_ID` + `GRAPH_API_KEY`.

Normal Explorer behavior:

1. activity and address views use The Graph when available;
2. transaction detail composes indexed tGFC transfer evidence with RPC or Blockscout execution evidence where available;
3. all source provenance is displayed explicitly;
4. `DATA_SOURCE_MODE=graph` can be used to force Graph-only behavior for normal Explorer reads.

## Accountability Analyst architecture

The Analyst is intentionally stricter than the normal Explorer.

1. The browser submits only a question, locale and evidence scope/target.
2. The server validates the target.
3. The server queries the live GFC Subgraph directly for the required indexed tGFC evidence.
4. For transaction scope only, the server may supplement that Graph evidence with Base Sepolia Blockscout transaction metadata. This secondary source is labeled explicitly and is not represented as a direct RPC receipt or as Graph-supplied data.
5. If The Graph cannot provide the required indexed evidence, the Analyst fails closed even if Blockscout is reachable.
6. The server sends the bounded evidence packet plus question to the configured AI provider.
7. Structured output is rendered as separate verified facts, limitations, non-conclusions and an evidence-scope statement.
8. The AI cannot modify deterministic verification states and is not an evidence source.

This makes The Graph a load-bearing part of the AI feature rather than a decorative data source.

## Base Sepolia RPC / Blockscout behavior

The RPC client validates chain ID `84532`, supports endpoint failover and treats recent log scans as bounded windows rather than complete history.

If a public RPC cannot serve an older transaction by hash, the normal transaction-detail path can transparently use Base Sepolia Blockscout. That response is labeled as indexed Blockscout evidence and is never represented as a direct RPC receipt.

## Trust and evidence boundaries

- A blockchain event can prove the event fields within its authenticated scope.
- A transaction sender (`from`) does not automatically prove organizational authority, and an ERC-20 `Transfer.from` address must not be assumed to equal the transaction sender.
- A successful execution does not prove policy compliance, purpose, beneficial outcome or impact.
- An indexed Graph entity is evidence returned by the configured Graph provider; it does not create missing governance/offchain facts.
- Blockscout transaction metadata, when used, is secondary indexed evidence and must remain provenance-distinct from The Graph and from direct JSON-RPC receipt evidence.
- AI output is explanatory, not an evidence source and not a new verification authority.
- The deterministic Funds / Authority / Rules / Decisions / Outcomes / Evidence states remain authoritative.

## Security posture

- read-only Explorer
- no wallet connection, signatures, approvals or contract writes
- no private keys
- same-origin browser API
- server-only AI/Graph secrets
- CSP and security headers
- input validation and rate limiting
- request timeouts
- structured AI output
- `store:false` for AI responses
