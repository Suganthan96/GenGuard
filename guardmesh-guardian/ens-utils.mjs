/**
 * ENS Integration Utilities for GuardMesh Guardians
 * 
 * Full-featured ENS module for:
 * - Forward resolution (name → address)
 * - Reverse resolution (address → name)
 * - Subname registration
 * - Text record read/write (guardian metadata)
 * - The Graph subgraph querying for guardian discovery
 * - Namehash / labelhash computation
 * - TTL-based caching
 */

import { ethers } from "ethers";

// ─────────────────────────────────────────────────────────────────────────────
// ENS Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const ENS_CONFIG = {
  // ENS Registry — same address on Mainnet + Sepolia
  ENS_REGISTRY: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",

  // Public Resolver (Mainnet v4)
  PUBLIC_RESOLVER_MAINNET: "0x231b0ee14048e9dccd1d247744d114d4c7fc10f2",
  // Public Resolver (Sepolia)
  PUBLIC_RESOLVER_SEPOLIA: "0xe99638b40e4fff0129d56f03b55b6bbc4bbe49b5",

  // Universal Resolver — recommended entrypoint
  UNIVERSAL_RESOLVER: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",

  // GuardMesh parent domain
  PARENT_DOMAIN: "guardmesh.eth",

  // Mainnet RPC (resolution always starts on L1)
  MAINNET_RPC: process.env.ENS_MAINNET_RPC || "https://eth.llamarpc.com",

  // Sepolia RPC (for testnet)
  SEPOLIA_RPC: process.env.ENS_SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com",
  RESOLUTION_RPC:
    process.env.ENS_RESOLUTION_RPC ||
    process.env.ENS_SEPOLIA_RPC ||
    process.env.ENS_MAINNET_RPC ||
    "https://ethereum-sepolia-rpc.publicnode.com",

  // 0G Chain
  ZERO_G_RPC: process.env.RPC_URL || "https://evmrpc-testnet.0g.ai",

  // The Graph ENS subgraph
  SUBGRAPH_URL:
    "https://api.thegraph.com/subgraphs/name/ensdomains/ens",

  // Guardian metadata text-record keys
  METADATA_KEYS: [
    "guardian.role",
    "guardian.version",
    "guardian.capabilities",
    "guardian.model",
    "guardian.status",
    "guardian.contact",
    "guardian.chainId",
    "guardian.registryAddress",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Namehash / Labelhash helpers (pure JS, no viem dependency)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute keccak256 labelhash of a single label.
 * @param {string} label  e.g. "guardian-1"
 * @returns {string} 0x-prefixed 32-byte hex
 */
export function labelhash(label) {
  return ethers.id(label);
}

/**
 * Compute ENS namehash (ENSIP-1 / EIP-137).
 *
 *   namehash("")            = 0x00…00
 *   namehash("eth")         = keccak256(namehash("") + labelhash("eth"))
 *   namehash("foo.eth")     = keccak256(namehash("eth") + labelhash("foo"))
 *
 * @param {string} name  Dot-separated ENS name (already normalised)
 * @returns {string} 0x-prefixed 32-byte hex
 */
export function namehash(name) {
  let node = "0x" + "00".repeat(32);
  if (!name) return node;

  const labels = name.split(".").reverse();
  for (const label of labels) {
    const lh = labelhash(label);
    node = ethers.solidityPackedKeccak256(
      ["bytes32", "bytes32"],
      [node, lh]
    );
  }
  return node;
}

/**
 * Normalise an ENS name (lowercase, trim).
 * Full UTS-46 / ENSIP-15 normalisation is complex; for hackathon
 * we lower-case + trim which covers ASCII names.
 */
export function normalizeName(name) {
  return name.toLowerCase().trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory TTL cache
// ─────────────────────────────────────────────────────────────────────────────

const _cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet(key, value) {
  _cache.set(key, { value, ts: Date.now() });
}

export function cacheClear() {
  _cache.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// ABI fragments (minimal)
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY_ABI = [
  "function resolver(bytes32 node) view returns (address)",
  "function owner(bytes32 node) view returns (address)",
  "function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl)",
];

const RESOLVER_ABI = [
  "function addr(bytes32 node) view returns (address)",
  "function text(bytes32 node, string key) view returns (string)",
  "function setText(bytes32 node, string key, string value)",
  "function setAddr(bytes32 node, address addr)",
  "function name(bytes32 node) view returns (string)",
  "function supportsInterface(bytes4 interfaceID) view returns (bool)",
  "function multicall(bytes[] data) returns (bytes[])",
];

// ─────────────────────────────────────────────────────────────────────────────
// Provider helpers
// ─────────────────────────────────────────────────────────────────────────────

let _mainnetProvider = null;

/**
 * Get (or create) a cached Mainnet provider.
 * ENS resolution always starts from L1.
 */
export function getMainnetProvider() {
  if (!_mainnetProvider) {
    _mainnetProvider = new ethers.JsonRpcProvider(ENS_CONFIG.RESOLUTION_RPC);
  }
  return _mainnetProvider;
}

/**
 * Allow callers to inject a custom provider (useful for tests / Sepolia).
 */
export function setMainnetProvider(provider) {
  _mainnetProvider = provider;
}

// ─────────────────────────────────────────────────────────────────────────────
// Forward Resolution  (name → address)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a full ENS name to an Ethereum address.
 *
 * @param {string} ensName  e.g. "guardian-1.guardmesh.eth"
 * @returns {Promise<string|null>} Checksummed address or null
 */
export async function resolveAddress(ensName) {
  const normalized = normalizeName(ensName);
  const cached = cacheGet(`addr:${normalized}`);
  if (cached) return cached;

  const provider = getMainnetProvider();
  const node = namehash(normalized);

  // 1. find resolver
  const registry = new ethers.Contract(
    ENS_CONFIG.ENS_REGISTRY,
    REGISTRY_ABI,
    provider
  );
  const resolverAddr = await registry.resolver(node);
  if (resolverAddr === ethers.ZeroAddress) return null;

  // 2. query addr()
  const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, provider);
  try {
    const address = await resolver.addr(node);
    if (address === ethers.ZeroAddress) return null;
    cacheSet(`addr:${normalized}`, address);
    return address;
  } catch {
    return null;
  }
}

/**
 * Convenience: resolve guardian label to address.
 * @param {string} guardianLabel  e.g. "guardian-1"
 */
export async function resolveGuardianAddress(guardianLabel) {
  const ensName = `${guardianLabel}.${ENS_CONFIG.PARENT_DOMAIN}`;
  const address = await resolveAddress(ensName);
  if (!address) {
    throw new Error(`ENS name ${ensName} did not resolve to an address`);
  }
  console.log(`✅ Resolved ${ensName} → ${address}`);
  return address;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reverse Resolution  (address → name)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reverse-resolve an address to its primary ENS name.
 *
 * @param {string} address  0x-prefixed address
 * @returns {Promise<string|null>} Primary name or null
 */
export async function reverseLookup(address) {
  const cached = cacheGet(`rev:${address}`);
  if (cached) return cached;

  const provider = getMainnetProvider();
  try {
    const name = await provider.lookupAddress(address);
    if (name) cacheSet(`rev:${address}`, name);
    return name;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Records  (guardian metadata)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read one text record from an ENS name's resolver.
 */
export async function getTextRecord(ensName, key) {
  const normalized = normalizeName(ensName);
  const cacheKey = `txt:${normalized}:${key}`;
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const provider = getMainnetProvider();
  const node = namehash(normalized);

  const registry = new ethers.Contract(ENS_CONFIG.ENS_REGISTRY, REGISTRY_ABI, provider);
  const resolverAddr = await registry.resolver(node);
  if (resolverAddr === ethers.ZeroAddress) return "";

  const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, provider);
  try {
    const value = await resolver.text(node, key);
    cacheSet(cacheKey, value || "");
    return value || "";
  } catch {
    return "";
  }
}

/**
 * Read all standard guardian metadata text records.
 * @param {string} ensName  Full ENS name
 * @returns {Promise<Object>} key→value map
 */
export async function getGuardianMetadata(ensName) {
  const normalized = normalizeName(ensName);
  const provider = getMainnetProvider();
  const node = namehash(normalized);

  const registry = new ethers.Contract(ENS_CONFIG.ENS_REGISTRY, REGISTRY_ABI, provider);
  const resolverAddr = await registry.resolver(node);
  if (resolverAddr === ethers.ZeroAddress) return {};

  const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, provider);
  const metadata = {};

  // Read records in parallel
  const results = await Promise.allSettled(
    ENS_CONFIG.METADATA_KEYS.map((key) =>
      resolver.text(node, key).then((v) => ({ key, value: v }))
    )
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value.value) {
      metadata[r.value.key] = r.value.value;
    }
  }

  console.log(`✅ Retrieved ${Object.keys(metadata).length} metadata fields for ${ensName}`);
  return metadata;
}

/**
 * Write metadata text records to an ENS name's resolver.
 * Requires signer to be the manager/owner of the name.
 *
 * @param {ethers.Signer} signer
 * @param {string} ensName
 * @param {Object} metadata  key→value pairs
 */
export async function setGuardianMetadata(signer, ensName, metadata) {
  const normalized = normalizeName(ensName);
  const node = namehash(normalized);

  const provider = signer.provider || getMainnetProvider();
  const registry = new ethers.Contract(ENS_CONFIG.ENS_REGISTRY, REGISTRY_ABI, provider);
  const resolverAddr = await registry.resolver(node);

  if (resolverAddr === ethers.ZeroAddress) {
    throw new Error(`No resolver set for ${ensName}`);
  }

  const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, signer);

  const entries = Object.entries(metadata);
  console.log(`📝 Writing ${entries.length} text records for ${ensName}...`);

  for (const [key, value] of entries) {
    const tx = await resolver.setText(node, key, String(value));
    await tx.wait();
    console.log(`   ✅ ${key} = ${value}`);
    // Invalidate cache
    _cache.delete(`txt:${normalized}:${key}`);
  }

  console.log(`✅ All metadata updated for ${ensName}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Subname Registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a guardian subname under guardmesh.eth.
 *
 * REQUIRES: signer must be the owner/manager of guardmesh.eth.
 *
 * @param {ethers.Signer} signer
 * @param {string} guardianLabel   e.g. "guardian-1"
 * @param {string} ownerAddress    Address that will own the subname
 * @returns {Promise<string>} Transaction hash
 */
export async function registerGuardianSubname(signer, guardianLabel, ownerAddress) {
  const parentNode = namehash(normalizeName(ENS_CONFIG.PARENT_DOMAIN));
  const lh = labelhash(guardianLabel);

  const registry = new ethers.Contract(ENS_CONFIG.ENS_REGISTRY, REGISTRY_ABI, signer);

  // Use the parent's resolver (or fallback to public resolver)
  const ensNetwork = (process.env.ENS_NETWORK || "sepolia").toLowerCase();
  const fallbackResolver =
    ensNetwork === "mainnet"
      ? ENS_CONFIG.PUBLIC_RESOLVER_MAINNET
      : ENS_CONFIG.PUBLIC_RESOLVER_SEPOLIA;

  let resolverAddr;
  try {
    resolverAddr = await registry.resolver(parentNode);
  } catch {
    resolverAddr = fallbackResolver;
  }
  if (resolverAddr === ethers.ZeroAddress) {
    resolverAddr = fallbackResolver;
  }

  console.log(`📝 Registering ${guardianLabel}.${ENS_CONFIG.PARENT_DOMAIN}...`);
  console.log(`   Owner   : ${ownerAddress}`);
  console.log(`   Resolver: ${resolverAddr}`);

  const tx = await registry.setSubnodeRecord(
    parentNode,
    lh,
    ownerAddress,
    resolverAddr,
    0 // TTL
  );
  const receipt = await tx.wait();
  console.log(`✅ Subname registered: ${receipt.hash}`);
  return receipt.hash;
}

// ─────────────────────────────────────────────────────────────────────────────
// The Graph — Guardian discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query The Graph ENS subgraph for all guardmesh.eth subdomains.
 * Returns an array of { name, owner }.
 */
export async function getAllGuardians() {
  const query = `{
    domains(where: { name: "${ENS_CONFIG.PARENT_DOMAIN}" }) {
      subdomains(first: 100) {
        name
        owner { id }
        resolver { addr { id } }
      }
      subdomainCount
    }
  }`;

  try {
    const res = await fetch(ENS_CONFIG.SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);
    const json = await res.json();

    const domains = json?.data?.domains?.[0];
    if (!domains) return [];

    return domains.subdomains.map((s) => ({
      name: s.name,
      owner: s.owner?.id || null,
      resolver: s.resolver?.addr?.id || null,
    }));
  } catch (err) {
    console.warn("⚠️ Subgraph query failed:", err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a complete ENS identity object for a guardian.
 */
export function createGuardianENSIdentity(guardianConfig) {
  const { id, address, roleScope, model, version, capabilities } = guardianConfig;
  const ensName = `${id}.${ENS_CONFIG.PARENT_DOMAIN}`;

  return {
    ensName,
    label: id,
    address,
    node: namehash(normalizeName(ensName)),
    metadata: {
      "guardian.role": roleScope || "code_analysis_only",
      "guardian.model": model || "qwen-2.5-7b-instruct",
      "guardian.version": version || "1.0.0",
      "guardian.capabilities": JSON.stringify(
        capabilities || ["role_check", "permission_check", "content_check"]
      ),
      "guardian.status": "active",
      "guardian.chainId": "16602",
      "guardian.registryAddress":
        process.env.GUARDMESH_REGISTRY_ADDRESS || "",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify that an ENS name resolves to the expected address.
 * Returns { verified, resolvedAddress }.
 */
export async function verifyENSIdentity(ensName, expectedAddress) {
  try {
    const resolved = await resolveAddress(ensName);
    const verified =
      resolved &&
      resolved.toLowerCase() === expectedAddress.toLowerCase();
    return { verified, resolvedAddress: resolved };
  } catch {
    return { verified: false, resolvedAddress: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export default {
  ENS_CONFIG,
  labelhash,
  namehash,
  normalizeName,
  cacheClear,
  getMainnetProvider,
  setMainnetProvider,
  resolveAddress,
  resolveGuardianAddress,
  reverseLookup,
  getTextRecord,
  getGuardianMetadata,
  setGuardianMetadata,
  registerGuardianSubname,
  getAllGuardians,
  createGuardianENSIdentity,
  verifyENSIdentity,
};
