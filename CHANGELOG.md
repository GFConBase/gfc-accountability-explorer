# Changelog

## 0.3.0 — 2026-09-08

Post-judging-day synchronization of the standalone ETHOnline repository with the Explorer state produced during the 8 September GFC website/Explorer integration work.

### Added

- published Base Sepolia GFC registry mirror for Explorer-side reference context;
- known GFC contract/test-treasury reference routes;
- read-only Base Sepolia address classification route;
- fail-closed GFC live snapshot route;
- reference/address investigation UI and planned Accountability Records boundary;
- malformed percent-encoded route hardening;
- seven regression tests covering the new reference/snapshot boundary.

### Changed

- canonical language URLs are now `https://explorer.globalfoundationcoin.org/en/` and `/de/`;
- legacy `/en/explorer/` and `/de/explorer/` paths redirect to the canonical Explorer subdomain;
- Netlify includes the published registry with the serverless function bundle;
- Explorer copy now explicitly states that The Graph is load-bearing for indexed tGFC activity but is not a universal Base indexer;
- documentation and local preview routes synchronized to the post-8-September architecture.

### Verified

- `npm run check` passes after synchronization;
- 40/40 Explorer tests pass;
- no wallet writes, approvals, signatures or contract writes were added;
- testnet/mainnet/presale/audit boundaries remain fail-closed and explicit.

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
