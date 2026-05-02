/**
 * Guardian ENS Bootstrap
 *
 * On startup each guardian:
 *  1. Initialises ENS utilities (namehash, provider)
 *  2. Derives its ENS name  →  guardian-X.guardmesh.eth
 *  3. Attempts forward resolution  (name → address)
 *  4. Attempts reverse resolution  (address → name)
 *  5. Verifies identity (forward == wallet address)
 *  6. Loads metadata from ENS text records
 *  7. Registers with on-chain GuardMeshRegistryENS (if contract addr set)
 *  8. Caches identity for runtime use
 *
 * Usage:
 *   node guardian-ens-boot.mjs                   # uses .env GUARDIAN_ID
 *   GUARDIAN_ID=guardian-2 node guardian-ens-boot.mjs
 */

import { ethers } from "ethers";
import dotenv from "dotenv";
import {
  ENS_CONFIG,
  namehash,
  normalizeName,
  resolveGuardianAddress,
  reverseLookup,
  getGuardianMetadata,
  setGuardianMetadata,
  createGuardianENSIdentity,
  verifyENSIdentity,
  registerGuardianSubname,
} from "./ens-utils.mjs";

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const GUARDIAN_ID      = process.env.GUARDIAN_ID || "guardian-1";
const PRIVATE_KEY      = (process.env.PRIVATE_KEY || "").trim().replace(/\.$/, "");
const RPC_URL          = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const REGISTRY_ADDRESS = process.env.GUARDMESH_ENS_REGISTRY_ADDRESS || process.env.GUARDMESH_REGISTRY_ADDRESS || "";
const ENS_AUTO_REGISTER = process.env.ENS_AUTO_REGISTER === "1";

// Minimal ABI for GuardMeshRegistryENS.registerAgentWithENS
const REGISTRY_ENS_ABI = [
  "function registerAgentWithENS(string agentId, string ensName, address resolvedAddress, string roleScope, string[] allowedActions, string ensRole, string ensModel, string ensVersion) returns (bytes32)",
  "function assignENSName(string agentId, string ensName, address resolvedAddress)",
  "function getAgentENSName(string agentId) view returns (string)",
  "function isRegistered(string agentId) view returns (bool)",
];

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

export async function bootstrapGuardianWithENS(overrideId) {
  const guardianId = overrideId || GUARDIAN_ID;

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     🔗  GuardMesh Guardian — ENS Identity Bootstrap      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // ── 1.  Wallet ────────────────────────────────────────────────────────────
  let wallet;
  if (PRIVATE_KEY) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  }
  const guardianAddress = wallet?.address || ethers.ZeroAddress;

  console.log(`  Guardian ID : ${guardianId}`);
  console.log(`  0G Address  : ${guardianAddress}`);
  console.log(`  0G RPC      : ${RPC_URL}\n`);

  // ── 2.  Build ENS identity ────────────────────────────────────────────────
  console.log("1️⃣  Building ENS identity…");
  const identity = createGuardianENSIdentity({
    id: guardianId,
    address: guardianAddress,
    roleScope: "code_analysis_only",
    model: "qwen-2.5-7b-instruct",
    version: "1.0.0",
    capabilities: [
      "role_check", "permission_check", "content_check",
      "intent_evaluation", "policy_verification",
    ],
  });

  console.log(`   ENS Name : ${identity.ensName}`);
  console.log(`   Node     : ${identity.node}`);

  // ── 3.  Forward resolution ────────────────────────────────────────────────
  console.log("\n2️⃣  Attempting ENS forward resolution…");
  let resolvedAddress = null;
  try {
    resolvedAddress = await resolveGuardianAddress(guardianId);
    console.log(`   ✅ ${identity.ensName} → ${resolvedAddress}`);
  } catch {
    console.log(`   ℹ️  Name not registered yet (normal for new guardians)`);
  }

  // ── 4.  Reverse resolution ────────────────────────────────────────────────
  console.log("\n3️⃣  Attempting ENS reverse resolution…");
  let primaryName = null;
  if (guardianAddress !== ethers.ZeroAddress) {
    primaryName = await reverseLookup(guardianAddress);
    if (primaryName) {
      console.log(`   ✅ ${guardianAddress} → ${primaryName}`);
    } else {
      console.log(`   ℹ️  No primary name set for this address`);
    }
  }

  // ── 5.  Verify identity ───────────────────────────────────────────────────
  console.log("\n4️⃣  Verifying ENS identity…");
  let verified = false;
  if (resolvedAddress) {
    const check = await verifyENSIdentity(identity.ensName, guardianAddress);
    verified = check.verified;
    console.log(
      verified
        ? `   ✅ Identity verified — ENS matches wallet`
        : `   ⚠️  Mismatch — ENS resolves to ${check.resolvedAddress}`
    );
  } else {
    console.log(`   ⏭️  Skipped (name not registered)`);
  }

  // ── 6.  Load metadata from ENS ────────────────────────────────────────────
  console.log("\n5️⃣  Loading ENS text records…");
  let ensMetadata = {};
  if (resolvedAddress) {
    try {
      ensMetadata = await getGuardianMetadata(identity.ensName);
      if (Object.keys(ensMetadata).length > 0) {
        for (const [k, v] of Object.entries(ensMetadata)) {
          console.log(`   📄 ${k} = ${v}`);
        }
      } else {
        console.log(`   ℹ️  No text records found`);
      }
    } catch (err) {
      console.log(`   ⚠️  Could not read metadata: ${err.message}`);
    }
  } else {
    console.log(`   ⏭️  Skipped (name not registered)`);
  }

  // ── 7.  On-chain registry (0G Chain) ──────────────────────────────────────
  console.log("\n6️⃣  On-chain registry sync…");
  if (REGISTRY_ADDRESS && wallet) {
    try {
      const registry = new ethers.Contract(
        REGISTRY_ADDRESS,
        REGISTRY_ENS_ABI,
        wallet
      );

      const alreadyRegistered = await registry.isRegistered(guardianId);
      if (alreadyRegistered) {
        const existingENS = await registry.getAgentENSName(guardianId);
        if (!existingENS || existingENS.length === 0) {
          console.log(`   📝 Assigning ENS name on-chain…`);
          const tx = await registry.assignENSName(
            guardianId,
            identity.ensName,
            guardianAddress
          );
          await tx.wait();
          console.log(`   ✅ ENS assigned on-chain`);
        } else {
          console.log(`   ✅ Already linked: ${existingENS}`);
        }
      } else {
        console.log(`   ℹ️  Agent not yet registered on-chain`);
        console.log(`       Run deploy + registerAgent first`);
      }
    } catch (err) {
      console.log(`   ⚠️  Registry sync skipped: ${err.message}`);
    }
  } else {
    console.log(`   ⏭️  Skipped (no GUARDMESH_REGISTRY_ADDRESS or PRIVATE_KEY)`);
  }

  // ── 8.  Auto-register subname (optional) ──────────────────────────────────
  if (ENS_AUTO_REGISTER && !resolvedAddress && wallet) {
    console.log("\n7️⃣  Auto-registering ENS subname…");
    try {
      const txHash = await registerGuardianSubname(
        wallet,
        guardianId,
        guardianAddress
      );
      console.log(`   ✅ Registered: ${txHash}`);
    } catch (err) {
      console.log(`   ⚠️  Auto-register failed: ${err.message}`);
      console.log(`       Register manually at https://app.ens.domains/`);
    }
  }

  // ── 9.  Build runtime config ──────────────────────────────────────────────
  const ensConfig = {
    guardianId,
    ensName: identity.ensName,
    ensNode: identity.node,
    address: guardianAddress,
    resolvedAddress,
    primaryName,
    verified,
    metadata: { ...identity.metadata, ...ensMetadata },
    cachedAt: new Date().toISOString(),
    ttl: 3600,
  };

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n┌────────────────────────────────────────────────────────────┐");
  console.log("│  ENS Bootstrap Summary                                    │");
  console.log("├────────────────────────────────────────────────────────────┤");
  console.log(`│  Name     : ${identity.ensName.padEnd(44)}│`);
  console.log(`│  Address  : ${guardianAddress.padEnd(44)}│`);
  console.log(`│  Resolved : ${(resolvedAddress || "—").padEnd(44)}│`);
  console.log(`│  Verified : ${String(verified).padEnd(44)}│`);
  console.log(`│  Primary  : ${(primaryName || "—").padEnd(44)}│`);
  console.log("└────────────────────────────────────────────────────────────┘");

  if (!resolvedAddress) {
    console.log("\n  📋 Next Steps:");
    console.log("  ┌─────────────────────────────────────────────────────────┐");
    console.log(`  │ 1. Go to https://app.ens.domains/`);
    console.log(`  │ 2. Register guardmesh.eth (if not done)`);
    console.log(`  │ 3. Create subname "${guardianId}"`);
    console.log(`  │ 4. Set resolver to Public Resolver`);
    console.log(`  │ 5. Set ETH address to ${guardianAddress}`);
    console.log("  │ 6. Re-run this bootstrap");
    console.log("  └─────────────────────────────────────────────────────────┘");
  }

  console.log("\n✨ Guardian ENS bootstrap complete!\n");
  return ensConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime metadata updater
// ─────────────────────────────────────────────────────────────────────────────

export async function updateGuardianMetadata(signerPrivateKey, ensName, metadata) {
  console.log(`\n📝 Updating metadata for ${ensName}…`);
  const provider = new ethers.JsonRpcProvider(ENS_CONFIG.RESOLUTION_RPC);
  const cleanPk = (signerPrivateKey || "").trim().replace(/\.$/, "");
  const signer = new ethers.Wallet(cleanPk, provider);
  await setGuardianMetadata(signer, ensName, metadata);
  console.log(`✅ Metadata updated`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry
// ─────────────────────────────────────────────────────────────────────────────

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`;

if (isMain) {
  bootstrapGuardianWithENS().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}

export default { bootstrapGuardianWithENS, updateGuardianMetadata };
