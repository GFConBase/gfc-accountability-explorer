# ETHOnline 2026 Continuity Disclosure

This standalone repository is synchronized from the Explorer-specific source currently maintained inside the unified GFC website project. It exists for ETHOnline Continuity review, code inspection and commit-history visibility.

## Project boundary

Global Foundation Coin (GFC) existed before ETHOnline 2026. The hackathon work extends that pre-existing project with the **GFC Accountability Explorer** and the **Accountability Analyst**. It must not be used to imply that the underlying GFC project, brand, website, pilot, documentation or accountability model originated during the hackathon.

## Pre-existing work

The following are pre-existing GFC work and are **not** claimed as ETHOnline-created work:

- Global Foundation Coin project and brand
- GFC logo and visual identity
- `globalfoundationcoin.org` website and Transparency Portal
- public Base Sepolia GFC pilot
- existing Base Sepolia contract/reference registry and technical deployment metadata
- `GFConBase/gfc-infrastructure`
- GFC token / economic specifications and documentation
- governance, authority, security and transparency documentation
- existing project architecture and roadmap
- canonical model: **Funds → Authority → Rules → Decisions → Outcomes → Evidence**

## New ETHOnline work

- read-only Accountability Explorer interface
- Explorer-specific responsive UI integrated into the GFC website codebase
- live-data server boundary and same-origin `/api/explorer/*` API
- Base Sepolia RPC fallback with chain-ID validation and endpoint failover
- historical Base Sepolia Blockscout transaction fallback with explicit provenance
- deployed GFC Transfer Subgraph on Base Sepolia in Subgraph Studio
- The Graph client and live indexed activity/address/transaction-event queries
- The Graph as the primary indexed activity source
- activity overview, address filtering and token-contract event-emitter scope
- transaction evidence detail
- Explorer-side integration of pre-existing GFC reference metadata, address classification and fail-closed snapshot reads
- accountability-oriented transformation layer
- verification states and limitation logic
- evidence-constrained **Accountability Analyst** natural-language interface
- Analyst server flow that requires live The Graph evidence and fails closed instead of substituting RPC/mock data
- structured AI output separating answer, verified facts, limitations and claims that cannot be concluded
- Explorer/Analyst tests, Netlify adapter and documentation

## External configuration not committed

- OpenAI API key for the live Accountability Analyst
- optional The Graph Gateway API key if the project later moves from the public Studio query endpoint to a Gateway deployment

## Not claimed as implemented

- no GFC Base Mainnet token
- no live GFC presale
- no production governance system
- no production Transparency Registry
- no independent production security audit
- no offchain evidence registry binding transactions to authority, decisions, rules, outcomes or impact

## Evidence rule

The Explorer and Analyst are intentionally conservative:

> Visibility is not authority. Execution is not purpose. A successful transaction is not proof of compliant use, beneficial outcome, or real-world impact.
