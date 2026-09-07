# GFC Transfer Subgraph

This directory is **new ETHOnline 2026 Continuity work**. It defines the event index used by the GFC Accountability Explorer for the public Base Sepolia tGFC pilot contract.

## Deployment status

The Subgraph is deployed on **Base Sepolia** in Subgraph Studio as:

`gfc-accountability-explorer`

The Explorer currently uses the public Studio query endpoint:

`https://api.studio.thegraph.com/query/1758809/gfc-accountability-explorer/version/latest`

The live Explorer Activity Overview uses this Subgraph as its primary indexed source.

No Graph deploy key or Graph Gateway API key is committed here.

## Indexed evidence

The schema indexes standard ERC-20 `Transfer` events from:

- Network: Base Sepolia
- Chain ID: `84532`
- Contract: `0x7262Cca91938ede6bB6560F81104Aa410848e7f3`

Indexed fields include:

- transaction hash;
- log index;
- block number;
- timestamp;
- `from`;
- `to`;
- raw token `value`;
- emitting contract.

The Explorer normalizes the raw token value to human-readable tGFC units server-side.

The Subgraph intentionally does **not** infer:

- economic purpose;
- governance authority;
- organizational authorization;
- rule/policy compliance;
- decision rationale;
- beneficial outcome;
- real-world impact.

## Source

```text
schema.graphql
subgraph.yaml
abis/GFCTestToken.json
src/mapping.ts
```

## Rebuild / redeploy

Use official The Graph tooling for code generation, build and deployment.

A typical flow is:

```text
graph codegen
graph build
graph deploy
```

Authentication/deploy credentials must stay outside Git.

## startBlock note

The manifest intentionally does not assert a start block. The original infrastructure deployment record did not authenticate a deployment block, and this source does not invent one. The deployed Subgraph successfully indexes the required pilot Transfer history without that optimization.
