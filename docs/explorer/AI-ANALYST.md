# GFC Accountability Analyst

## Purpose

The Accountability Analyst is the ETHOnline 2026 Continuity AI feature built on top of the live GFC Subgraph.

It provides a natural-language interface for three evidence scopes:

- indexed recent tGFC activity
- indexed activity involving a specific address
- a specific Base Sepolia transaction and its indexed tGFC Transfer evidence

## Load-bearing use of The Graph

The Analyst does not accept blockchain facts from the browser. For every analyst request, the server constructs a fresh evidence packet whose load-bearing primary blockchain source is the deployed GFC Subgraph through The Graph.

For recent-activity and address scopes, the packet contains indexed tGFC activity from The Graph only. For a transaction scope, the packet may additionally include **Base Sepolia Blockscout** as a secondary indexed source for historical transaction metadata when available. Blockscout metadata is explicitly labeled as secondary provenance and is never represented as a direct JSON-RPC receipt or as data supplied by The Graph.

If The Graph is not configured or cannot serve the required indexed tGFC evidence, the Analyst fails closed. It does not replace the required Graph evidence with RPC, Blockscout-only evidence, or static/mock data.

Normal Explorer pages may transparently use RPC or Blockscout fallbacks for availability. The AI feature has a stricter boundary because live The Graph evidence is a required, load-bearing part of the feature.

## Evidence boundary

The deterministic GFC model remains authoritative:

`Funds -> Authority -> Rules -> Decisions -> Outcomes -> Evidence`

The AI is explanatory only. It is explicitly instructed not to:

- upgrade deterministic verification states
- infer governance authority from key control
- infer policy/rule compliance from transaction execution
- infer decision rationale from a blockchain transaction
- infer economic purpose, legitimacy, valuation, outcome, impact, or offchain facts without evidence
- treat an ERC-20 Transfer sender as automatically equal to the transaction sender (`from`)
- treat missing indexed evidence as proof that no historical activity exists outside the indexed scope

## Server flow

```text
Browser question
      |
      v
POST /api/explorer/analyst
      |
      v
Server validates scope + target
      |
      v
Live query to deployed GFC Subgraph via The Graph
      |
      v
Server builds bounded evidence packet
      |
      +--> The Graph: primary indexed tGFC / Transfer-event evidence
      |
      +--> optional Blockscout: secondary indexed historical transaction metadata
      |
      v
OpenAI Responses API (structured output)
      |
      v
Answer + verified facts + limitations + cannot-conclude list
```

## Provenance and authority

- **The Graph** is the primary indexed evidence source for tGFC activity and Transfer events used by the Analyst.
- **Base Sepolia Blockscout**, when present in a transaction packet, supplies secondary indexed historical transaction metadata only.
- **OpenAI / the AI model** is explanatory only and is not itself an evidence source.
- The deterministic GFC accountability model remains authoritative for all verification states.
- A transaction `from` field is described as the **transaction sender**, not as proof of signature identity, organizational authority, or governance authorization.

## Privacy and secrets

- `OPENAI_API_KEY` is server-side only.
- `GRAPH_API_KEY`, if a Graph Gateway deployment is used later, is server-side only.
- The browser calls same-origin `/api/explorer/*` routes.
- The Explorer is read-only and does not request wallet connection, signatures, approvals, or transactions.
- OpenAI Responses requests are configured with `store: false`.

## Configuration

Required for AI:

```env
OPENAI_API_KEY=...
```

Defaults:

```env
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=low
OPENAI_MAX_OUTPUT_TOKENS=900
OPENAI_TIMEOUT_MS=30000
```

The deployed public GFC Subgraph Studio endpoint is configured as the Explorer's default The Graph endpoint and may be overridden with `GRAPH_STUDIO_QUERY_URL`.

## Demo path

Recommended demo:

1. Show Activity Overview using `Data source: The Graph` and indexed history.
2. Open the real tGFC transfer transaction.
3. Show deterministic accountability states and limitations.
4. Ask the Analyst: `What does this transaction prove, and what does it not prove?`
5. Show that the AI response names concrete verified facts while explicitly refusing unsupported governance, purpose, and impact conclusions.
