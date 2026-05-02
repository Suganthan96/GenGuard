// ─────────────────────────────────────────────────────────────────────────────
// GuardMesh — Deploy ENS-integrated Registry
//
// Deploys GuardMeshRegistryENS (which inherits GuardMeshRegistry) and
// optionally registers demo guardian agents with ENS names.
//
// Usage:
//   npx hardhat run scripts/deploy-ens.js --network testnet
//   npx hardhat run scripts/deploy-ens.js --network hardhat
// ─────────────────────────────────────────────────────────────────────────────

const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  GuardMesh ENS Registry — Deployment");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`  Network   : ${network.name} (chainId ${network.config.chainId})`);
  console.log(`  Deployer  : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance   : ${ethers.formatEther(balance)} OG`);
  console.log("══════════════════════════════════════════════════════════\n");

  // ── 1. Deploy GuardMeshRegistryENS ────────────────────────────────────────
  console.log("▶  Deploying GuardMeshRegistryENS...");
  const RegistryENS = await ethers.getContractFactory("GuardMeshRegistryENS");
  const registryENS = await RegistryENS.deploy();
  await registryENS.waitForDeployment();
  const registryAddress = await registryENS.getAddress();
  console.log(`   ✅  GuardMeshRegistryENS deployed at: ${registryAddress}`);

  // ── 2. Verify namehash computation ────────────────────────────────────────
  console.log("\n▶  Verifying on-chain namehash...");
  try {
    const ethNode = await registryENS.computeNamehash("eth");
    console.log(`   namehash("eth")            = ${ethNode}`);

    const guardmeshNode = await registryENS.computeNamehash("guardmesh.eth");
    console.log(`   namehash("guardmesh.eth")  = ${guardmeshNode}`);

    const g1Node = await registryENS.computeSubnameHash("guardian-1", "guardmesh.eth");
    console.log(`   subnameHash("guardian-1")  = ${g1Node}`);
  } catch (err) {
    console.warn(`   ⚠  Namehash verification skipped: ${err.message}`);
  }

  // ── 3. Register demo guardians ────────────────────────────────────────────
  console.log("\n▶  Registering demo guardians with ENS names...");

  const guardians = [
    {
      id: "guardian-1",
      ensName: "guardian-1.guardmesh.eth",
      role: "code_analysis_only",
      model: "qwen-2.5-7b-instruct",
      version: "1.0.0",
      actions: ["read_file", "query_db", "analyze_code"],
    },
    {
      id: "guardian-2",
      ensName: "guardian-2.guardmesh.eth",
      role: "data_access_audit",
      model: "llama-3.3-70b-versatile",
      version: "1.0.0",
      actions: ["read_file", "query_db", "audit_access"],
    },
    {
      id: "guardian-3",
      ensName: "guardian-3.guardmesh.eth",
      role: "intent_verification",
      model: "qwen-2.5-7b-instruct",
      version: "1.0.0",
      actions: ["evaluate_intent", "verify_policy"],
    },
  ];

  for (const g of guardians) {
    try {
      const tx = await registryENS.registerAgentWithENS(
        g.id,
        g.ensName,
        deployer.address, // resolved address (deployer for demo)
        g.role,
        g.actions,
        g.role,
        g.model,
        g.version
      );
      const receipt = await tx.wait();
      console.log(`   ✅  ${g.id} → ${g.ensName} (tx: ${receipt.hash.slice(0, 18)}…)`);
    } catch (err) {
      console.warn(`   ⚠  ${g.id}: ${err.message}`);
    }
  }

  // ── 4. Verify reads ───────────────────────────────────────────────────────
  console.log("\n▶  Reading back ENS identities...");
  for (const g of guardians) {
    try {
      const identity = await registryENS.getAgentENSIdentity(g.id);
      console.log(`   ${g.id}:`);
      console.log(`     ensName  : ${identity.ensName}`);
      console.log(`     ensNode  : ${identity.ensNode.slice(0, 18)}…`);
      console.log(`     address  : ${identity.resolvedAddress}`);
      console.log(`     role     : ${identity.role}`);
      console.log(`     model    : ${identity.model}`);
    } catch (err) {
      console.warn(`   ⚠  ${g.id}: ${err.message}`);
    }
  }

  // ── 5. Save deployment ────────────────────────────────────────────────────
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);

  const deploymentInfo = {
    network:    network.name,
    chainId:    network.config.chainId,
    deployer:   deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      GuardMeshRegistryENS: {
        address: registryAddress,
        txHash:  registryENS.deploymentTransaction()?.hash ?? "n/a",
      },
    },
    guardians: guardians.map((g) => ({
      id: g.id,
      ensName: g.ensName,
      role: g.role,
    })),
  };

  const outPath = path.join(deploymentsDir, `${network.name}-ens.json`);
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  ENS Deployment Complete");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`  GuardMeshRegistryENS : ${registryAddress}`);
  console.log(`  Guardians registered : ${guardians.length}`);
  console.log(`  Saved to             : deployments/${network.name}-ens.json`);
  console.log("══════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exitCode = 1;
});
