# Architecture

## Runtime data flow

```text
Browser (read-only)
        |
        | same-origin GET /api/*
        v
Node 20 Explorer server
        |
        +------------------------------+
        |                              |
        | primary when configured      | bounded fallback
        v                              v
The Graph Gateway               Base Sepolia JSON-RPC
server-side API key             no signing / no writes
        |                              |
        v                              v
GFC Transfer entities           tx / receipt / recent logs
        +--------------+---------------+
                       |
                       v
              normalization layer
                       |
                       v
             accountability mapping
                       |
                       v
 Funds / Authority / Rules / Decisions / Outcomes / Evidence
                       |
                       v
              human-readable UI
```

## Trust and evidence boundaries

The Explorer deliberately treats each layer as having a limited evidentiary scope.

- **Base Sepolia transaction data** can establish that specific onchain execution occurred.
- **The Graph data** can establish that the configured provider returned indexed entities matching the deployed subgraph schema; it does not create authority or purpose evidence by itself.
- **Transformation code** can classify what the available records support; it must not fill missing facts.
- **GFC documentation** provides project context but does not automatically bind a particular transaction to a governance decision or offchain rule.

## The Graph architecture

`subgraph/` is a deployment-prepared definition for indexing `Transfer` events from the public Base Sepolia tGFC pilot. It is not represented as deployed in this commit.

When `GRAPH_SUBGRAPH_ID` and `GRAPH_API_KEY` are configured on the server:

1. activity views query The Graph first;
2. address activity queries sent and received transfer entities from The Graph;
3. transaction detail composes indexed tGFC transfer evidence from The Graph with the Base Sepolia transaction receipt;
4. the browser never receives the Graph API key.

If The Graph is not configured, `DATA_SOURCE_MODE=auto` uses a clearly disclosed Base Sepolia RPC recent-window fallback. That fallback is live blockchain data but explicitly **not complete historical indexing**.

## Security posture

The application is intentionally read-only.

- no wallet connection
- no signature requests
- no approvals
- no token transfers
- no contract writes
- no private keys
- no client-side Graph secrets
- predefined GraphQL documents only
- validated address / transaction search
- same-origin browser API
- CSP and other security headers
- request timeouts, caching, deduplication and basic rate limiting
