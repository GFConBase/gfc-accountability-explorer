# Changelog

## 0.2.0 — 2026-09-07

Final ETHOnline Continuity synchronization after public production deployment.

### Added

- live The Graph Subgraph integration;
- deployed Base Sepolia GFC Transfer Subgraph status;
- Base Sepolia Blockscout historical transaction fallback;
- evidence-bounded Accountability Analyst;
- server-side OpenAI Responses integration;
- structured Analyst output;
- German Explorer route;
- Netlify Function adapter used by production;
- production-subdomain documentation;
- source-of-truth and synchronization documentation;
- expanded deterministic/provider/Analyst test suite.

### Changed

- repository layout now mirrors the Explorer-specific layout of the unified GFC website project;
- The Graph status updated from prepared/not-deployed to live/deployed;
- prize-readiness documentation updated to the live demo state;
- security documentation updated for Graph + Blockscout + AI provenance boundaries;
- standalone local development now uses the same Explorer server modules as production.

### Verified

- `npm run check` passes;
- 33/33 tests pass;
- no real `.env`, `.netlify`, `node_modules` or API secrets are included;
- live production Explorer validated at `https://explorer.globalfoundationcoin.org/`.

## 0.1.0 — 2026-09-06

Initial standalone ETHOnline Accountability Explorer implementation with Base Sepolia RPC fallback, prepared Graph integration, deterministic accountability mapping and Continuity documentation.
