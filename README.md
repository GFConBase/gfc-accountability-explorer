# GFC Accountability Explorer

**ETHOnline 2026 Continuity Track build for Global Foundation Coin (GFC).**

The GFC Accountability Explorer is a new public-facing component designed to turn live onchain activity into structured, human-readable accountability evidence.

Instead of treating a blockchain transaction as the end of the transparency process, the Explorer is intended to help answer broader questions around financial execution, authority, rules, decisions and verifiable evidence.

> **Current status:** Development has started for ETHOnline 2026.  
> This repository contains the new hackathon-specific work and does not represent a finished production system.

---

## Project Context

**Global Foundation Coin (GFC)** is an existing project building on Base.

Its current product focus is the **GFC Token / Economic Layer**, supported by transparency, governance and verification mechanisms.

Long term, GFC aims to develop broader accountability infrastructure around the model:

**Funds → Authority → Rules → Decisions → Outcomes → Evidence**

The Accountability Explorer extends this existing direction with a new data and verification interface.

---

## ETHOnline 2026 — Continuity Disclosure

This project participates in the **ETHOnline 2026 Continuity Track**.

GFC existed before ETHOnline 2026.

### Pre-existing work

The following existed before this hackathon and must not be interpreted as ETHOnline work:

- Global Foundation Coin project and brand
- GFC website and public documentation
- GFC Token / Economic Layer specifications
- Base Sepolia proof-of-concept infrastructure
- existing governance and transparency documentation
- existing GFC infrastructure repository
- existing project architecture, roadmap and token model

Pre-existing infrastructure:

https://github.com/GFConBase/gfc-infrastructure

Project website:

https://globalfoundationcoin.org/

---

## ETHOnline 2026 Work

This repository is dedicated to the **new work developed during ETHOnline 2026**.

The intended hackathon scope includes:

- GFC Accountability Explorer frontend
- live onchain data ingestion
- structured accountability-oriented data views
- transaction and activity exploration
- evidence-oriented presentation of blockchain data
- integration with The Graph where implemented
- supporting data transformation and query logic
- hackathon-specific documentation and deployment

Only functionality actually implemented during the hackathon will be presented as completed work in the final submission.

---

## Core Problem

Blockchain systems are good at proving that a transaction occurred.

That alone does not automatically explain:

- what was financially executed
- who had authority
- which rules applied
- what decision caused the transaction
- what happened afterward
- which claims can independently be verified

The Accountability Explorer is intended to make these relationships easier to inspect.

---

## Intended Data Flow

The current target architecture is:

```text
Live blockchain data
        ↓
The Graph / blockchain data layer
        ↓
Query + transformation logic
        ↓
Accountability-oriented data model
        ↓
GFC Accountability Explorer
        ↓
Human-readable evidence views
```

This architecture is still under development.

The final README will document the exact libraries, endpoints, contracts, queries and deployment infrastructure actually used.

---

## The Graph

The Graph is intended to serve as a load-bearing data source for the Explorer rather than as a decorative integration.

The objective is to query live blockchain activity and transform it into structured views that are more useful for accountability and verification than raw transaction data alone.

Exact implementation details will be added as development progresses.

---

## Development Principles

### Live data over mock data

Where technically feasible, the finished demonstration should use real blockchain data rather than static or manually fabricated datasets.

### Evidence over claims

The interface should distinguish between:

- verifiable information
- contextual interpretation
- planned functionality
- information that remains unavailable or unverified

### Clear continuity boundary

Existing GFC infrastructure and new ETHOnline work remain explicitly separated.

### Public development history

Hackathon development will be committed frequently so that the evolution of the project can be independently reviewed.

---

## AI Assistance Disclosure

AI assistance is used transparently during development.

**ChatGPT is used for:**

- coding
- troubleshooting
- translation

Product direction, scope, integration decisions, testing, verification and deployment remain founder-directed.

---

## Repository Status

```text
Track:            ETHOnline 2026 — Continuity Track
Project:          Global Foundation Coin (GFC)
Component:        Accountability Explorer
Category:         Data / Analytics
Network focus:    Base
Development:      In progress
Production ready: No
```

---

## Related Links

**GFC Website**  
https://globalfoundationcoin.org/

**Existing GFC Infrastructure**  
https://github.com/GFConBase/gfc-infrastructure

**GitHub Organization**  
https://github.com/GFConBase

---

## License

MIT License
