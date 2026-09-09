import fs from 'node:fs';
import path from 'node:path';
import { NETWORK } from '../config.js';
import { isAddress, normalizeAddress } from '../validation.js';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function registryError(message) {
  const error = new Error(message);
  error.code = 'GFC_REGISTRY_UNAVAILABLE';
  return error;
}

export function createGfcReferenceStore(config) {
  const registryPath = path.join(config?.rootDir || process.cwd(), 'contracts', 'base-sepolia', 'registry.json');
  let cached = null;

  function loadRegistry() {
    if (cached) return cached;
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    } catch {
      throw registryError('Published GFC Base Sepolia registry could not be loaded.');
    }
    if (parsed?.network?.chainId !== NETWORK.chainId) {
      throw registryError('Published GFC registry network does not match Base Sepolia.');
    }
    const token = parsed.contracts?.find((item) => item.id === 'gfc-token-pilot');
    if (!token || String(token.address).toLowerCase() !== NETWORK.contract.toLowerCase()) {
      throw registryError('Published GFC registry does not match the configured pilot token.');
    }
    cached = parsed;
    return cached;
  }

  function treasuryReference(registry) {
    const relationship = registry.systemRelationships?.find(
      (item) => item.relation === 'forwards-payments-to' && isAddress(item.targetAddress),
    );
    if (!relationship) return null;
    return {
      id: 'gfc-test-treasury',
      order: 4,
      referenceType: 'address',
      contractType: 'wallet',
      displayName: relationship.targetLabel || { de: 'Test-Treasury-Adresse', en: 'Test Treasury Address' },
      address: relationship.targetAddress,
      status: { lifecycle: 'testing' },
      classification: { currentReference: true, testnetOnly: true, officialMainnetTreasury: false, depositAddress: false },
      purpose: {
        de: 'Fest konfigurierte Base-Sepolia-Test-Treasury-Adresse des GFC Test Presale. Keine veröffentlichte Mainnet-Treasury.',
        en: 'Fixed Base Sepolia test-treasury reference used by the GFC Test Presale. No published mainnet treasury.',
      },
      explorerLinks: {
        baseScan: `${registry.network.baseScanUrl}/address/${relationship.targetAddress}`,
        blockscout: `${registry.network.blockscoutUrl}/address/${relationship.targetAddress}`,
      },
    };
  }

  function list() {
    const registry = loadRegistry();
    const contracts = (registry.contracts || []).map((item) => ({ ...clone(item), referenceType: 'contract' }));
    const treasury = treasuryReference(registry);
    return treasury ? [...contracts, treasury] : contracts;
  }

  function find(value) {
    const needle = String(value || '').trim().toLowerCase();
    if (!needle) return null;
    return list().find((item) => item.id.toLowerCase() === needle || String(item.address).toLowerCase() === needle) || null;
  }

  function loadManifest(reference) {
    if (!reference?.manifestUrl || reference.referenceType === 'address') return null;
    const relativePath = String(reference.manifestUrl).replace(/^\/+/, '');
    const manifestPath = path.join(config?.rootDir || process.cwd(), relativePath);
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      return null;
    }
    if (manifest?.id !== reference.id || manifest?.network?.chainId !== NETWORK.chainId) return null;
    if (String(manifest?.address || '').toLowerCase() !== String(reference.address || '').toLowerCase()) return null;
    return manifest;
  }

  function detail(value) {
    const reference = find(value);
    if (!reference) return null;
    const registry = loadRegistry();
    const manifest = loadManifest(reference);
    const relationships = (registry.systemRelationships || []).filter(
      (item) => item.sourceId === reference.id || item.targetId === reference.id || String(item.targetAddress || '').toLowerCase() === String(reference.address).toLowerCase(),
    );
    const manifestUrl = reference.manifestUrl
      ? `https://globalfoundationcoin.org${reference.manifestUrl}`
      : null;
    return {
      ...reference,
      network: clone(registry.network),
      projectStatus: clone(registry.projectStatus),
      relationships: clone(relationships),
      externalDependencies: clone(registry.externalDependencies || []),
      manifestUrl,
      manifestUpdatedAt: manifest?.manifestUpdatedAt || null,
      deployment: clone(manifest?.deployment || null),
      initialFunding: clone(manifest?.initialFunding || null),
      verification: clone(manifest?.verification || null),
      compiler: clone(manifest?.compiler || null),
      constructor: clone(manifest?.constructor || null),
      properties: clone(manifest?.properties || null),
      control: clone(manifest?.control || null),
      technical: manifest ? {
        compiler: clone(manifest.compiler || null),
        constructor: clone(manifest.constructor || null),
        properties: clone(manifest.properties || null),
        control: clone(manifest.control || null),
        frontend: clone(manifest.frontend || null),
        sourceFiles: clone(manifest.sourceFiles || []),
      } : null,
      limitations: clone(manifest?.limitations || [
        'testnet-only',
        'not-mainnet-gfc',
        'no-guaranteed-financial-value',
        'not-a-deposit-address',
        'not-externally-audited',
      ]),
      notice: clone(manifest?.notice || reference.shortNotice || null),
      transparencyContext: 'https://globalfoundationcoin.org/en/transparency/#references',
    };
  }

  function normalizeKnownAddress(value) {
    if (!isAddress(value)) return null;
    return find(normalizeAddress(value));
  }

  return { loadRegistry, list, find, detail, normalizeKnownAddress };
}
