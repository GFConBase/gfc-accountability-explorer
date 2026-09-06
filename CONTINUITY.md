# ETHOnline 2026 Continuity Disclosure

## Project boundary

Global Foundation Coin (GFC) existed before ETHOnline 2026. This repository contains the new **GFC Accountability Explorer** work built during the event and must not be used to imply that the underlying GFC project, brand, website, pilot, documentation or accountability model originated during the hackathon.

## Pre-existing work

The following are pre-existing GFC work and are **not** claimed as ETHOnline-created work:

- Global Foundation Coin project and brand
- GFC logo and visual identity
- `globalfoundationcoin.org` website and Transparency Portal
- public Base Sepolia GFC pilot
- `GFConBase/gfc-infrastructure`
- GFC token / economic specifications and documentation
- governance, authority, security and transparency documentation
- existing project architecture and roadmap
- canonical model: **Funds → Authority → Rules → Decisions → Outcomes → Evidence**

### Pre-existing asset reused here

`web/assets/logo-gfc.png` is copied from the current GFC website solely to keep the new Explorer visually consistent with the existing project. It is explicitly a pre-existing brand asset.

## New ETHOnline work in this repository state

- standalone read-only Accountability Explorer web application
- new Explorer-specific UI and responsive design implementation
- live-data server boundary
- Base Sepolia RPC read-only fallback
- The Graph server-side data-service abstraction
- GraphQL documents for activity, address and transaction-event retrieval
- prepared GFC Transfer subgraph schema / manifest / mapping
- activity overview and address filtering
- transaction evidence detail
- accountability-oriented transformation layer
- verification states and limitations logic
- search validation and safe external explorer linking
- caching, request deduplication, timeout and rate-limit controls
- Explorer-specific tests and build/security tooling
- ETHOnline-specific architecture, prize-readiness and continuity documentation

## Not claimed as implemented

- no GFC Base Mainnet token
- no live GFC presale
- no production governance system
- no production Transparency Registry
- no independent production security audit
- no deployed GFC subgraph in this repository state
- no live Graph credentials in this repository
- no Accountability Analyst / AI feature yet
- no offchain evidence registry binding transactions to authority, decisions, rules, outcomes or impact

## Evidence rule

The Explorer is intentionally conservative:

> Visibility is not authority. Execution is not purpose. A successful transaction is not proof of compliant use, beneficial outcome, or real-world impact.
