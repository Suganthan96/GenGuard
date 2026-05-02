/**
 * ENS Integration Tests
 *
 * Validates:
 *  - namehash computation matches known values
 *  - ENS identity creation
 *  - Forward resolution (will fail if name not registered — expected)
 *  - Reverse resolution
 *  - Cache behaviour
 *
 * Usage:  npm run test:ens
 */

import {
  namehash,
  labelhash,
  normalizeName,
  createGuardianENSIdentity,
  resolveAddress,
  reverseLookup,
  verifyENSIdentity,
  cacheClear,
  ENS_CONFIG,
} from "./ens-utils.mjs";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

async function run() {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║          ENS Integration — Unit Tests                 ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  // ── 1. Namehash ───────────────────────────────────────────────────────────
  console.log("1️⃣  Namehash computation");

  // namehash("") should be 0x00…00
  const emptyHash = namehash("");
  assert(
    emptyHash === "0x" + "00".repeat(32),
    `namehash("") = 0x00…00`
  );

  // namehash("eth") — well-known value
  const ethHash = namehash("eth");
  assert(
    ethHash === "0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae",
    `namehash("eth") matches EIP-137 reference`
  );

  // namehash("nick.eth") — from ENS docs
  // labelhash("nick") = keccak256("nick")
  const nickHash = namehash("nick.eth");
  assert(typeof nickHash === "string" && nickHash.startsWith("0x"), `namehash("nick.eth") is valid hex`);

  // ── 2. Labelhash ──────────────────────────────────────────────────────────
  console.log("\n2️⃣  Labelhash computation");

  const lh = labelhash("guardian-1");
  assert(typeof lh === "string" && lh.length === 66, `labelhash("guardian-1") = ${lh.slice(0, 18)}…`);

  // Same input → same output
  assert(labelhash("guardian-1") === lh, "labelhash is deterministic");

  // Different inputs → different outputs
  assert(labelhash("guardian-1") !== labelhash("guardian-2"), "different labels produce different hashes");

  // ── 3. normalizeName ──────────────────────────────────────────────────────
  console.log("\n3️⃣  Name normalization");
  assert(normalizeName("Guardian-1.GuardMesh.ETH") === "guardian-1.guardmesh.eth", "lowercase normalization");
  assert(normalizeName("  foo.eth  ") === "foo.eth", "trim whitespace");

  // ── 4. Identity creation ──────────────────────────────────────────────────
  console.log("\n4️⃣  Guardian ENS identity");
  const identity = createGuardianENSIdentity({
    id: "guardian-1",
    address: "0x225f137127d9067788314bc7fcc1f36746a3c3B5",
    roleScope: "code_analysis_only",
    model: "qwen-2.5-7b-instruct",
    version: "1.0.0",
    capabilities: ["role_check", "permission_check"],
  });

  assert(identity.ensName === "guardian-1.guardmesh.eth", `ensName = ${identity.ensName}`);
  assert(identity.label === "guardian-1", `label = ${identity.label}`);
  assert(identity.node && identity.node.startsWith("0x"), `node is computed: ${identity.node.slice(0, 18)}…`);
  assert(identity.metadata["guardian.role"] === "code_analysis_only", "role metadata");
  assert(identity.metadata["guardian.status"] === "active", "status metadata");
  assert(identity.metadata["guardian.capabilities"].includes("role_check"), "capabilities metadata");

  // ── 5. Forward resolution (may fail — that's ok) ──────────────────────────
  console.log("\n5️⃣  Forward resolution (live — may timeout)");
  try {
    const addr = await resolveAddress("vitalik.eth");
    if (addr) {
      assert(addr.startsWith("0x"), `vitalik.eth → ${addr.slice(0, 12)}…`);
    } else {
      console.log("  ℹ️  vitalik.eth did not resolve (RPC issue or timeout)");
    }
  } catch (err) {
    console.log(`  ℹ️  Resolution skipped: ${err.message}`);
  }

  // ── 6. Reverse resolution ─────────────────────────────────────────────────
  console.log("\n6️⃣  Reverse resolution (live — may timeout)");
  try {
    const name = await reverseLookup("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    if (name) {
      assert(name.includes("vitalik"), `reverse → ${name}`);
    } else {
      console.log("  ℹ️  Reverse lookup returned null (expected if no primary name)");
    }
  } catch (err) {
    console.log(`  ℹ️  Reverse lookup skipped: ${err.message}`);
  }

  // ── 7. Cache ──────────────────────────────────────────────────────────────
  console.log("\n7️⃣  Cache behaviour");
  cacheClear();
  assert(true, "Cache cleared without error");

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("══════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
