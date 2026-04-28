// ─────────────────────────────────────────────────────────────────────────────
// GuardMesh — Deployment Script
// Deploys GuardMeshRegistry and GuardMeshAudit to 0G Chain.
//
// Usage:
//   npm run deploy:testnet   →  Galileo testnet (chainId 16602)
//   npm run deploy:mainnet   →  Mainnet         (chainId 16661)
//
// After deployment, contract addresses are saved to deployments/<network>.json
// ─────────────────────────────────────────────────────────────────────────────

const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n══════════════════════════════════════════════");
  console.log("  GuardMesh Contract Deployment");
  console.log("══════════════════════════════════════════════");
  console.log(`  Network   : ${network.name} (chainId ${network.config.chainId})`);
  console.log(`  Deployer  : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance   : ${ethers.formatEther(balance)} OG`);
  console.log("══════════════════════════════════════════════\n");

  if (balance === 0n) {
    throw new Error(
      "Deployer wallet has 0 balance. " +
      "Get testnet tokens from the 0G faucet before deploying."
    );
  }

  // ── 1. Deploy GuardMeshRegistry ──────────────────────────────────────────
  console.log("▶  Deploying GuardMeshRegistry...");
  const Registry = await ethers.getContractFactory("GuardMeshRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`   ✅  GuardMeshRegistry deployed at: ${registryAddress}`);

  // ── 2. Deploy GuardMeshAudit ─────────────────────────────────────────────
  console.log("\n▶  Deploying GuardMeshAudit...");
  const Audit = await ethers.getContractFactory("GuardMeshAudit");
  const audit = await Audit.deploy();
  await audit.waitForDeployment();
  const auditAddress = await audit.getAddress();
  console.log(`   ✅  GuardMeshAudit deployed at:    ${auditAddress}`);

  // ── 3. Post-deployment wiring ─────────────────────────────────────────────
  // Authorize the deployer address as an initial recorder (replace with your
  // consensus engine address in production).
  console.log("\n▶  Authorizing deployer as initial recorder on GuardMeshAudit...");
  const authTx = await audit.authorizeRecorder(deployer.address);
  await authTx.wait();
  console.log(`   ✅  Authorized: ${deployer.address}`);

  // ── 4. Save deployment info ───────────────────────────────────────────────
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);

  const deploymentInfo = {
    network:         network.name,
    chainId:         network.config.chainId,
    deployer:        deployer.address,
    deployedAt:      new Date().toISOString(),
    contracts: {
      GuardMeshRegistry: {
        address: registryAddress,
        txHash:  registry.deploymentTransaction()?.hash ?? "n/a",
      },
      GuardMeshAudit: {
        address: auditAddress,
        txHash:  audit.deploymentTransaction()?.hash ?? "n/a",
      },
    },
  };

  const outPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n══════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("══════════════════════════════════════════════");
  console.log(`  GuardMeshRegistry : ${registryAddress}`);
  console.log(`  GuardMeshAudit    : ${auditAddress}`);
  console.log(`  Saved to          : deployments/${network.name}.json`);
  console.log("\n  Next steps:");
  console.log(`  npm run verify:${network.name}`);
  console.log("══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exitCode = 1;
});
