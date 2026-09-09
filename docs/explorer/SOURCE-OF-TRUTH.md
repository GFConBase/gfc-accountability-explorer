# Source of Truth

## Production

The canonical production source for the Accountability Explorer is maintained inside the unified GFC website project.

Explorer-specific production paths:

```text
/css/explorer/
/js/explorer/
/partials/de/explorer/
/partials/en/explorer/
/lib/explorer/
/contracts/base-sepolia/
/netlify/functions/explorer-api.mjs
/subgraph/explorer/
/tests/explorer/
/docs/explorer/
```

## ETHOnline standalone repository

`GFConBase/gfc-accountability-explorer` exists to provide:

- a focused open-source view of the ETHOnline work;
- Continuity disclosure;
- commit-history inspection;
- a runnable local Explorer;
- the deployed Subgraph source;
- deterministic tests;
- synchronized copies of the public Base Sepolia GFC reference registry and its contract manifests used by the Explorer;
- architecture, security and prize-readiness documentation.

This repository should be synchronized from the production Explorer-specific paths at meaningful submission milestones. It should not become a separately diverging production codebase.

## Secrets and deployment state

The following are intentionally external to Git:

- OpenAI API key;
- optional Graph Gateway API key;
- Netlify project linkage;
- Netlify domain/TLS state;
- DNS state;
- other GFC production environment secrets.

A repository clone can run the public Graph-backed Explorer without secrets. The AI Analyst requires a server-side OpenAI key.
