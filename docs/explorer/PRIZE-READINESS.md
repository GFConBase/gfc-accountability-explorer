# ETHOnline 2026 / The Graph Prize Readiness

Status synchronized on **2026-09-07**.

## Continuity status

This is a Continuity build. Pre-existing GFC work and the new Explorer/Analyst work are explicitly separated in `CONTINUITY.md`.

## Public demo status

Live:

`https://explorer.globalfoundationcoin.org/`

Validated production behavior includes:

- The Graph shown as the active indexed data source;
- indexed tGFC activity available;
- real Base Sepolia transaction lookup;
- historical Blockscout fallback with explicit provenance;
- Accountability Analyst configured and returning evidence-bounded output;
- existing GFC website routes remaining functional after integration.

## The Graph status

The GFC Subgraph is deployed on **Base Sepolia** in Subgraph Studio as:

`gfc-accountability-explorer`

Public query endpoint:

`https://api.studio.thegraph.com/query/1758809/gfc-accountability-explorer/version/latest`

The Subgraph indexes tGFC `Transfer` events emitted by:

`0x7262Cca91938ede6bB6560F81104Aa410848e7f3`

The Activity Overview uses The Graph as the primary indexed source.

## Continuity AI feature

The Accountability Analyst is a natural-language layer over live indexed tGFC evidence from The Graph.

Qualification-oriented implementation properties:

- The Graph is load-bearing for the Analyst's primary tGFC / Transfer-event evidence.
- Analyst requests fail closed if The Graph cannot provide the required indexed evidence packet.
- RPC-only or Blockscout-only data cannot replace The Graph for the Analyst evidence packet.
- For transaction scope, Base Sepolia Blockscout may supplement Graph evidence with explicitly labeled **secondary indexed historical transaction metadata**.
- Blockscout metadata is never represented as a direct JSON-RPC receipt or as evidence supplied by The Graph.
- The AI performs explanatory reasoning over a bounded live evidence packet rather than merely printing GraphQL output.
- The deterministic GFC evidence model remains authoritative.
- The AI cannot upgrade verification states.
- The AI is not itself an evidence source.
- Server-side secrets are kept out of browser JavaScript.
- The source and Continuity boundary are documented publicly.

## Live demo transaction

`0x2afbe77b1d4141cdcc900645a85afb19a319508621da12606541e7a1cb0c56a8`

Recommended Analyst question:

`What can actually be verified about this transaction, and what remains unproven?`

The expected evidence discipline is:

- The Graph: associated tGFC Transfer-event evidence;
- Blockscout: secondary historical transaction status/from/to/timestamp/block metadata when RPC cannot serve the lookup;
- AI: explanatory only;
- deterministic verification states: authoritative.

## Repository synchronization status

The synchronized standalone ETHOnline repository state was committed and published on **2026-09-07**.

Current public repository:

`https://github.com/GFConBase/gfc-accountability-explorer`

The repository reflects the production-integrated Explorer architecture and retains the existing Git history.

## Remaining submission work

- record a concise 2–4 minute demo video;
- prepare final ETHGlobal description and submission fields;
- explicitly select the applicable Continuity prize/pool;
- perform a final submission-day live demo and link check.

## Other The Graph prize tracks

Do not represent this project as qualifying for a separate composition/standardization track unless the implementation actually satisfies that track's distinct requirements.
