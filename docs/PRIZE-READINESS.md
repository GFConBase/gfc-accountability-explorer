# ETHOnline 2026 / The Graph Prize Readiness

Checked against the official ETHOnline 2026 prize page on **2026-09-06**:
https://ethglobal.com/events/ethonline2026/prizes

## Continuity status

This repository is a Continuity build. The pre-existing GFC work and the new Explorer work are separated in `CONTINUITY.md` and in the main README.

ETHGlobal's general rules require Continuity submissions to document pre-existing work and show substantive new functionality developed during the event:
https://ethglobal.com/rules

## The Graph status in this commit

**Prepared / optionally functional when externally configured, but not yet a qualifying final The Graph submission by itself.**

Implemented here:

- server-side Graph Gateway client
- predefined GraphQL activity, address and transaction-event queries
- server-side API-key boundary
- GFC Transfer subgraph schema / manifest / mapping
- The Graph as primary activity source when a real deployed subgraph ID and API key are configured
- Base Sepolia RPC as a transparent bounded fallback, never disguised as Graph data

Not implemented / not available in this repository state:

- deployed GFC subgraph ID
- Graph API key
- confirmed live Graph provider consumption from this repository's own deployment
- Accountability Analyst / AI reasoning interface
- Subgraph MCP integration
- Substreams integration

## Important current prize rule

The ETHOnline 2026 prize page currently lists the Continuity-specific The Graph prize as **“Best AI Tooling or AI Use Case with The Graph (Continuity)”**. Its qualification requirements include using The Graph as a load-bearing live data source and doing meaningful AI/agent work with that data.

Therefore, this Explorer foundation should **not** be presented as already qualified for that prize. The strongest next step is to deploy the prepared GFC subgraph, connect real live Graph data, then implement the evidence-constrained Accountability Analyst on top of that live Graph source.

The separate **Best Use of Composable or Standardized Graph Products** prize has different requirements, including composition/standardization and live provider data. A single custom subgraph query alone does not satisfy that prize either.
