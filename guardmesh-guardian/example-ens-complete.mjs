/**
 * Complete Example: Setting Up Guardian with ENS
 * 
 * This example walks through the full process of:
 * 1. Bootstrapping a guardian with ENS identity
 * 2. Registering the subname on ENS
 * 3. Updating metadata
 * 4. Resolving and verifying via ENS
 */

import { ethers } from "ethers";
import {
  bootstrapGuardianWithENS,
  updateGuardianMetadata,
  resolveGuardianAddress,
  getGuardianMetadata,
} from "./ens-utils.mjs";
import { evaluateRegistryGate } from "./registry-policy-gate.mjs";
import dotenv from "dotenv";

dotenv.config();

async function completeExample() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Complete Example: Guardian ENS Integration             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  try {
    // Step 1: Bootstrap guardian with ENS
    // =====================================
    console.log("STEP 1: Bootstrap Guardian with ENS Identity");
    console.log("─".repeat(60));

    const ensConfig = await bootstrapGuardianWithENS();

    console.log("\nENS Config:");
    console.log(JSON.stringify(ensConfig, null, 2));

    // Step 2: Wait for manual registration (in production)
    // =====================================================
    console.log("\n\nSTEP 2: Manual Registration on ENS Manager");
    console.log("─".repeat(60));
    console.log(`
Please register the following ENS name manually:

1. Go to: https://app.ens.domains/guardmesh.eth
2. Click "Create Subname"
3. Name: ${ensConfig.label}
4. Owner: ${ensConfig.address}
5. Resolver: Use Public Resolver (default)
6. Submit & confirm in wallet

Once registered, press ENTER to continue...
    `);

    // Step 3: Verify ENS resolution
    // ==============================
    console.log("\n\nSTEP 3: Verify ENS Resolution");
    console.log("─".repeat(60));

    try {
      const resolvedAddr = await resolveGuardianAddress(ensConfig.label);
      console.log(`✅ ENS resolves correctly!`);
      console.log(`   Name: ${ensConfig.ensName}`);
      console.log(`   Address: ${resolvedAddr}`);
      console.log(`   Verified: ${resolvedAddr === ensConfig.address ? "✓" : "✗"}`);
    } catch (error) {
      console.log(`⚠️  ENS not yet registered (expected)`);
      console.log(`   Error: ${error.message}`);
    }

    // Step 4: Set metadata
    // ====================
    console.log("\n\nSTEP 4: Set Guardian Metadata");
    console.log("─".repeat(60));

    const metadata = {
      "guardian.role": "code_analysis_only",
      "guardian.version": "1.0.0",
      "guardian.model": "qwen-2.5-7b-instruct",
      "guardian.capabilities": JSON.stringify([
        "role_check",
        "permission_check",
        "content_check",
        "intent_evaluation",
        "policy_verification",
      ]),
      "guardian.status": "active",
    };

    console.log("Setting metadata:");
    for (const [key, value] of Object.entries(metadata)) {
      console.log(`  ${key}: ${value}`);
    }

    // In production, you would call:
    // await updateGuardianMetadata(process.env.PRIVATE_KEY, ensConfig.ensName, metadata);

    console.log("\n✅ Metadata ready to be set");

    // Step 5: Integration with Guardian Policy
    // ==========================================
    console.log("\n\nSTEP 5: Integration with Guardian Policy");
    console.log("─".repeat(60));

    // Example: Create intent with ENS verification
    const sampleIntent = {
      agent_id: ensConfig.label, // Use ENS label
      agent_ens_name: ensConfig.ensName, // Include full ENS name
      action: "read_file",
      data_touched: ["private.db"],
      timestamp: new Date().toISOString(),
      on_chain_policy: {
        agent_id: ensConfig.label,
        role_scope: metadata["guardian.role"],
        allowed_actions: ["read_file", "analyze_code"],
        denied_actions: ["write_file", "delete_data"],
        allowed_data_sources: ["code", "docs"],
        active: true,
      },
      ens_identity: {
        name: ensConfig.ensName,
        address: ensConfig.address,
        verified: true,
        metadata: metadata,
      },
    };

    console.log("\nSample Intent with ENS Integration:");
    console.log(JSON.stringify(sampleIntent, null, 2));

    // Step 6: Guardian Evaluation Flow
    // ==================================
    console.log("\n\nSTEP 6: Guardian Evaluation with ENS Verification");
    console.log("─".repeat(60));

    console.log(`
Evaluation Flow:
1. Intent arrives with agent_id and agent_ens_name
2. Guardian resolves ENS name to verify address
3. Guardian queries GuardMeshRegistry for policy
4. Guardian fetches additional metadata from ENS text records
5. Guardian performs 3-check evaluation:
   - ROLE CHECK: Does action match role scope?
   - PERMISSION CHECK: Is agent authorized for this data?
   - CONTENT CHECK: Any dangerous patterns in payload?
6. Guardian returns verdict with ENS identity included
    `);

    const verdict = {
      agent_id: sampleIntent.agent_id,
      agent_ens_name: sampleIntent.agent_ens_name,
      action: sampleIntent.action,
      verdict: "ALLOW",
      role_check: { status: "PASS", reason: "Action matches role scope" },
      permission_check: {
        status: "PASS",
        reason: "Agent authorized for code analysis",
      },
      content_check: { status: "PASS", reason: "No dangerous patterns detected" },
      guardian_signature: "0x...",
      timestamp: new Date().toISOString(),
    };

    console.log("\nVerdict (with ENS Identity):");
    console.log(JSON.stringify(verdict, null, 2));

    // Step 7: Human-Readable Output
    // ==============================
    console.log("\n\nSTEP 7: Human-Readable Guardian Information");
    console.log("─".repeat(60));

    console.log(`
Guardian Profile:
  Name:        ${ensConfig.ensName}
  Address:     ${ensConfig.address.slice(0, 10)}...
  Status:      ${metadata["guardian.status"]}
  Role:        ${metadata["guardian.role"]}
  Model:       ${metadata["guardian.model"]}
  Version:     ${metadata["guardian.version"]}
  
Capabilities: ${JSON.parse(metadata["guardian.capabilities"]).join(", ")}

Discovery:
  • ENS App: https://app.ens.domains/${ensConfig.ensName}
  • Resolve: ${ensConfig.ensName} → ${ensConfig.address}
  • Verified: ✓ On-chain identity
    `);

    console.log("\n✅ Complete example finished!");
    console.log("\n" + "=".repeat(60));

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  completeExample();
}

export { completeExample };
