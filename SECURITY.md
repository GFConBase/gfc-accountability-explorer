# Security

## Scope

This repository is a read-only Explorer application for a public Base Sepolia pilot. It is not a wallet, custody system, token-sale interface, transaction signer, or contract administration interface.

## Deliberate security constraints

The application contains no feature that should require users to:

- connect a wallet;
- sign a message;
- sign a transaction;
- approve token spending;
- transfer funds;
- submit a private key or seed phrase;
- execute a smart-contract write.

If a future feature introduces any of those capabilities, it should be treated as a new security boundary and reviewed separately before release.

## Secrets

The Graph API key is server-side only. Never expose a real key through browser JavaScript or commit it to Git.

Use `.env.example` as a template and keep real `.env` files local or in a deployment platform's secret store.

## Application controls

Current controls include:

- strict address and transaction-hash validation;
- fixed GraphQL query documents rather than arbitrary user-supplied GraphQL;
- upstream request timeouts;
- same-origin browser API;
- in-memory request caching / deduplication;
- basic rate limiting;
- safe production error responses without upstream stack traces;
- CSP, frame denial, MIME sniffing protection and a restrictive Permissions Policy;
- DOM construction via text nodes instead of injecting untrusted HTML;
- fixed BaseScan link origins plus validated identifiers;
- `noopener noreferrer` on new-tab links.

## Status language

This repository must not use source verification as a synonym for a security audit. The Base Sepolia pilot is a non-production testnet deployment. No production security audit is represented as completed by the current GFC infrastructure repository.

## Reporting

Do not include private keys, seed phrases, access tokens or other secrets in a public issue. Use the official GFC contact channel published on the project website for sensitive reports.
