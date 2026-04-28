// ─────────────────────────────────────────────────────────────────────────────
// GuardMesh — Anchor one decision on GuardMeshAudit (recordDecision).
//
// There is no automatic "intent → chain" path in this repo yet; the Web intent
// API only collects AXL verdicts. Use this script (or your own service) after
// you have a bytes32 merkle root for the decision bundle (e.g. from 0G Storage).
//
// Usage (env vars — PowerShell: $env:MERKLE_ROOT="0x..."; npm run record-decision:testnet):
//   MERKLE_ROOT        required, 0x + 64 hex
//   AGENT_ID           default suguagent.eth
//   APPROVED           default true
//   OUTCOME            1=APPROVED 2=BLOCKED 3=CONTESTED 4=PENDING (default 1)
//   ACTION_TYPE        default code_analysis
//   TARGET             default workspace
//   APPROVE_COUNT      default 3
//   BLOCK_COUNT        default 0
//   BLOCKED_REASON     default ""
//   INTENT_TIMESTAMP   default now (seconds)
//   GUARDMESH_AUDIT_ADDRESS  optional; else deployments/<network>.json
//
// Or pass a JSON file after -- (same keys as env, camelCase allowed):
//   npx hardhat run scripts/record-decision.js --network testnet -- ./payload.json
// ─────────────────────────────────────────────────────────────────────────────

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const OUTCOME_APPROVED = 1;
const OUTCOME_BLOCKED = 2;
const OUTCOME_CONTESTED = 3;
const OUTCOME_PENDING = 4;

function loadDeploymentAuditAddress() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No deployments/${network.name}.json — deploy first or set GUARDMESH_AUDIT_ADDRESS`);
  }
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const addr = j.contracts?.GuardMeshAudit?.address;
  if (!addr) throw new Error(`GuardMeshAudit address missing in ${file}`);
  return addr;
}

function parseArgsFile() {
  const dash = process.argv.indexOf("--");
  const rest = dash === -1 ? [] : process.argv.slice(dash + 1);
  const jsonPath = rest.find((a) => a.endsWith(".json") && fs.existsSync(a));
  if (!jsonPath) return null;
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

async function main() {
  const fromFile = parseArgsFile();
  const merkleRoot =
    (fromFile?.merkleRoot || fromFile?.merkle_root || process.env.MERKLE_ROOT || "").trim();
  if (!merkleRoot || !/^0x[0-9a-fA-F]{64}$/.test(merkleRoot)) {
    throw new Error(
      "Set MERKLE_ROOT to a bytes32 hex string (0x + 64 hex), or pass a JSON file with merkleRoot."
    );
  }

  const agentId = (fromFile?.agentId ?? fromFile?.agent_id ?? process.env.AGENT_ID ?? "suguagent.eth").trim();
  const approved = String(fromFile?.approved ?? process.env.APPROVED ?? "true").toLowerCase() !== "false";
  const outcome = Number(fromFile?.outcome ?? process.env.OUTCOME ?? OUTCOME_APPROVED);
  const actionType = (fromFile?.actionType ?? fromFile?.action_type ?? process.env.ACTION_TYPE ?? "code_analysis").trim();
  const target = (fromFile?.target ?? process.env.TARGET ?? "workspace").trim();
  const approveCount = Number(fromFile?.approveCount ?? fromFile?.approve_count ?? process.env.APPROVE_COUNT ?? 3);
  const blockCount = Number(fromFile?.blockCount ?? fromFile?.block_count ?? process.env.BLOCK_COUNT ?? 0);
  const blockedReason = (fromFile?.blockedReason ?? fromFile?.blocked_reason ?? process.env.BLOCKED_REASON ?? "").trim();
  const intentTimestamp = Number(
    fromFile?.intentTimestamp ?? fromFile?.intent_timestamp ?? process.env.INTENT_TIMESTAMP ?? Math.floor(Date.now() / 1000)
  );

  const validOutcome = [OUTCOME_APPROVED, OUTCOME_BLOCKED, OUTCOME_CONTESTED, OUTCOME_PENDING].includes(outcome);
  if (!validOutcome) throw new Error(`Invalid outcome ${outcome}; use 1–4`);

  const auditAddress =
    (process.env.GUARDMESH_AUDIT_ADDRESS || "").trim() || loadDeploymentAuditAddress();

  const [signer] = await ethers.getSigners();
  const audit = new ethers.Contract(
    auditAddress,
    [
      "function recordDecision(string agentId, bytes32 merkleRoot, bool approved, uint8 outcome, string actionType, string target, uint8 approveCount, uint8 blockCount, string blockedReason, uint256 intentTimestamp) external",
    ],
    signer
  );

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  GuardMeshAudit.recordDecision");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  Network : ${network.name}`);
  console.log(`  Audit   : ${auditAddress}`);
  console.log(`  Signer  : ${signer.address}`);
  console.log("══════════════════════════════════════════════════════════════");
  console.log("\n  >>> Merkle root (paste into Web → Audit trail lookup):\n");
  console.log(`      ${merkleRoot}`);
  console.log("\n══════════════════════════════════════════════════════════════\n");

  const tx = await audit.recordDecision(
    agentId,
    merkleRoot,
    approved,
    outcome,
    actionType,
    target,
    approveCount,
    blockCount,
    blockedReason,
    intentTimestamp
  );
  console.log(`  Submitted tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  Mined in block: ${receipt.blockNumber}`);
  console.log("\n  DecisionRecorded event — merkleRoot topic matches the value above.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
