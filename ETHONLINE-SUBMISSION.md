# ETHOnline 2026 Submission Snapshot

## Project

**GFC Accountability**

Category: Data / Analytics

Continuity project extending pre-existing Global Foundation Coin infrastructure.

## One-line description

An explorer turning onchain activity into verifiable accountability evidence.

## Live demo

https://explorer.globalfoundationcoin.org/

## Core demo flow

1. Open the Explorer and show `Data source: The Graph`.
2. Show indexed tGFC activity.
3. Open:
   `0x2afbe77b1d4141cdcc900645a85afb19a319508621da12606541e7a1cb0c56a8`
4. Show the six deterministic evidence domains.
5. Ask:
   `What can actually be verified about this transaction, and what remains unproven?`
6. Show that The Graph Transfer evidence and Blockscout transaction metadata retain separate provenance.
7. Show that the AI refuses unsupported authority, rules, decision, purpose and impact claims.

## The Graph

Subgraph Studio project:

`gfc-accountability-explorer`

Query endpoint:

`https://api.studio.thegraph.com/query/1758809/gfc-accountability-explorer/version/latest`

Network:

`Base Sepolia`

## Pilot contract

`0x7262Cca91938ede6bB6560F81104Aa410848e7f3`

## Evidence model

**Funds → Authority → Rules → Decisions → Outcomes → Evidence**

## Continuity

The GFC project, brand, website, pilot and accountability model predate ETHOnline 2026.

The Explorer, indexed data integration, accountability transformation/UI and Accountability Analyst are the Continuity work documented in this repository.

See `CONTINUITY.md` for the full boundary.
