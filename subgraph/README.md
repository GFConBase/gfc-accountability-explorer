# Prepared GFC Subgraph

This directory is **new ETHOnline 2026 work**. It defines a minimal event index for the public Base Sepolia `tGFC` pilot contract.

## Status

- schema: prepared
- manifest: prepared
- mapping: prepared
- deployment to Subgraph Studio / Graph Network: **not performed by this repository state**
- Subgraph ID: **not available**
- Graph API key: **not included**

Nothing in this directory should be interpreted as evidence that a GFC subgraph is already deployed or serving live data.

## Indexed evidence

The current schema indexes only standard ERC-20 `Transfer` events from:

- Network: Base Sepolia
- Chain ID: `84532`
- Contract: `0x7262Cca91938ede6bB6560F81104Aa410848e7f3`

It intentionally does not infer purpose, authority, governance approval, compliance, outcome, or impact from those events.

## Build and deploy later

Use the latest official Graph CLI and `@graphprotocol/graph-ts` as documented by The Graph:

1. Install current Graph tooling.
2. Run `graph codegen` in this directory.
3. Run `graph build`.
4. Create a Subgraph Studio project.
5. Authenticate the Graph CLI.
6. Deploy this subgraph.
7. Put the resulting subgraph ID and a server-side API key into the Explorer server environment.

Official manifest documentation:
https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/

The manifest uses the current documented `specVersion: 1.3.0` and mapping `apiVersion: 0.0.9` as of 2026-09-06.

## Why there is no startBlock

The current `gfc-infrastructure/DEPLOYMENTS.md` records the public pilot but explicitly states that the deployment transaction and block are not authenticated in that repository record. The manifest therefore does not invent or silently promote a start block from a weaker source. A verified start block can be added in a later commit.
