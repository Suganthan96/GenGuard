# GuardMesh Smart Contracts - Deployment Summary

## ✅ Deployment Complete

**Network:** 0G Galileo Testnet (Chain ID: 16602)  
**Deployed:** April 23, 2026 11:35:32 UTC  
**Deployer:** `0x588F6b3169F60176c1143f8BaB47bCf3DeEbECdc`

---

## 📝 Deployed Contracts

### GuardMeshRegistry
**Address:** `0x0bfB6f131A99D5aaA3071618FFBD5bb3ea87C619`  
**Transaction:** `0x30da53979ef818e7abda95149c16af508b500e445d02cb87d26d33e8258356c2`  
**Explorer:** https://chainscan-galileo.0g.ai/address/0x0bfB6f131A99D5aaA3071618FFBD5bb3ea87C619

**Purpose:** Agent identity and policy store
- Stores per-agent policies (role scope, allowed/denied actions)
- Consensus threshold configuration
- Guardians query this at runtime

**Key Functions:**
- `registerAgent(agentId, roleScope, allowedActions)`
- `updatePolicy(agentId, allowedActions, deniedActions, allowedDataSources, consensusThreshold)`
- `getPolicy(agentId)` - Returns full policy for guardian evaluation
- `deactivateAgent(agentId)` - Emergency stop
- `getAllAgentsPaginated(offset, limit)` - For dashboard

### GuardMeshAudit
**Address:** `0x522748669646A1a099474cd7f98060968A80E812`  
**Transaction:** `0x8a197c365a821ed226bac9a75dee7d021882181a69defff68c4f420beb8cb645`  
**Explorer:** https://chainscan-galileo.0g.ai/address/0x522748669646A1a099474cd7f98060968A80E812

**Purpose:** Immutable decision ledger
- Records merkle root of every decision bundle
- Stores outcome (APPROVED/BLOCKED/CONTESTED/PENDING)
- Provides tamper-proof audit trail

**Key Functions:**
- `recordDecision(agentId, merkleRoot, approved, outcome, ...)` - Anchor decision on-chain
- `getDecision(merkleRoot)` - Retrieve decision by merkle root
- `getAgentHistory(agentId)` - Full audit trail for an agent
- `getAllDecisionsPaginated(offset, limit)` - For dashboard
- `verifyDecision(merkleRoot)` - Verify decision exists and outcome

---

## 🔐 Contract Features

### GuardMeshRegistry Features
✅ Agent registration with unique IDs  
✅ Role-based access control (owner-only updates)  
✅ Consensus threshold options: Any1, Majority, Unanimous  
✅ Allowed/denied action lists  
✅ Data source permissions  
✅ Agent activation/deactivation  
✅ Ownership transfer  
✅ Pagination for large datasets  

### GuardMeshAudit Features
✅ Immutable decision recording  
✅ Merkle root verification  
✅ Outcome tracking (4 states)  
✅ Guardian vote counts  
✅ Authorized recorder system  
✅ Per-agent history  
✅ Global audit trail  
✅ Pagination for dashboard  

---

## 🎯 Integration Guide

### 1. Register an Agent

```javascript
import { ethers } from "ethers";

const registryAddress = "0x0bfB6f131A99D5aaA3071618FFBD5bb3ea87C619";
const registryABI = [...]; // From artifacts/contracts/GuardMeshRegistry.sol/GuardMeshRegistry.json

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const wallet = new ethers.Wallet(privateKey, provider);
const registry = new ethers.Contract(registryAddress, registryABI, wallet);

// Register agent
const tx = await registry.registerAgent(
  "eng-assistant-04",
  "code_analysis_only",
  ["read_file", "query_db"]
);
await tx.wait();
console.log("Agent registered!");
```

### 2. Update Policy

```javascript
// Update full policy
const tx = await registry.updatePolicy(
  "eng-assistant-04",
  ["read_file", "query_db"],                    // allowed
  ["forum_post", "change_permissions"],         // denied
  ["source_code", "analytics_db"],              // data sources
  2                                             // threshold: 2=Majority
);
await tx.wait();
```

### 3. Query Policy (Guardian)

```javascript
// Guardians call this before evaluation
const policy = await registry.getPolicy("eng-assistant-04");

console.log("Role Scope:", policy.roleScope);
console.log("Allowed Actions:", policy.allowedActions);
console.log("Denied Actions:", policy.deniedActions);
console.log("Consensus Threshold:", policy.consensusThreshold);
console.log("Active:", policy.active);
```

### 4. Record Decision (Consensus Engine)

```javascript
const auditAddress = "0x522748669646A1a099474cd7f98060968A80E812";
const auditABI = [...]; // From artifacts

const audit = new ethers.Contract(auditAddress, auditABI, wallet);

// First, authorize your consensus engine address
await audit.authorizeRecorder(consensusEngineAddress);

// Then record decisions
const merkleRoot = "0x..."; // From 0G Storage
const tx = await audit.recordDecision(
  "eng-assistant-04",           // agentId
  merkleRoot,                   // merkle root from 0G Storage
  false,                        // approved (false = blocked)
  2,                            // outcome: 2=BLOCKED
  "forum_post",                 // actionType
  "internal-engineering-forum", // target
  1,                            // approveCount
  2,                            // blockCount
  "Role scope violation",       // blockedReason
  Date.now()                    // intentTimestamp
);
await tx.wait();
```

### 5. Verify Decision

```javascript
// Anyone can verify a decision
const decision = await audit.getDecision(merkleRoot);

console.log("Agent:", decision.agentId);
console.log("Approved:", decision.approved);
console.log("Outcome:", decision.outcome); // 1=APPROVED, 2=BLOCKED, 3=CONTESTED, 4=PENDING
console.log("Action:", decision.actionType);
console.log("Votes:", `${decision.approveCount}/${decision.blockCount}`);
console.log("Reason:", decision.blockedReason);
console.log("Recorded:", new Date(decision.recordedAt * 1000));
```

---

## 📊 Dashboard Integration

### Activity Feed (Page 1)
```javascript
// Get recent decisions
const { page, total } = await audit.getAllDecisionsPaginated(0, 20);

page.forEach(decision => {
  const color = decision.outcome === 1 ? 'green' : 
                decision.outcome === 2 ? 'red' : 
                decision.outcome === 3 ? 'amber' : 'gray';
  
  console.log(`[${color}] ${decision.agentId} → ${decision.actionType}`);
});
```

### Audit Trail (Page 3)
```javascript
// Get agent history
const history = await audit.getAgentHistoryPaginated("eng-assistant-04", 0, 50);

history.page.forEach(decision => {
  console.log(`${decision.actionType} → ${decision.approved ? 'APPROVED' : 'BLOCKED'}`);
  console.log(`  Reason: ${decision.blockedReason}`);
  console.log(`  Merkle Root: ${decision.merkleRoot}`);
});
```

### Policy Editor (Page 4)
```javascript
// Get current policy
const policy = await registry.getPolicy("eng-assistant-04");

// Update via form
await registry.updatePolicy(
  "eng-assistant-04",
  formData.allowedActions,
  formData.deniedActions,
  formData.dataSources,
  formData.threshold
);
```

---

## 🔍 Verification

### View on Explorer

**GuardMeshRegistry:**  
https://chainscan-galileo.0g.ai/address/0x0bfB6f131A99D5aaA3071618FFBD5bb3ea87C619

**GuardMeshAudit:**  
https://chainscan-galileo.0g.ai/address/0x522748669646A1a099474cd7f98060968A80E812

### Verify Contracts (Optional)

```bash
npm run verify:testnet
```

This will verify the source code on 0G Chain Scan (requires API key).

---

## 🧪 Testing

### Test Registry

```bash
# In 0g-contracts directory
npx hardhat console --network testnet
```

```javascript
const registry = await ethers.getContractAt(
  "GuardMeshRegistry",
  "0x0bfB6f131A99D5aaA3071618FFBD5bb3ea87C619"
);

// Register test agent
await registry.registerAgent("test-agent-01", "testing", ["test_action"]);

// Get policy
const policy = await registry.getPolicy("test-agent-01");
console.log(policy);
```

### Test Audit

```javascript
const audit = await ethers.getContractAt(
  "GuardMeshAudit",
  "0x522748669646A1a099474cd7f98060968A80E812"
);

// Record test decision
const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-decision-1"));
await audit.recordDecision(
  "test-agent-01",
  merkleRoot,
  false,
  2,
  "test_action",
  "test_target",
  1,
  2,
  "Test block reason",
  Date.now()
);

// Verify
const decision = await audit.getDecision(merkleRoot);
console.log(decision);
```

---

## 📁 Files

- **Contracts:** `contracts/GuardMeshRegistry.sol`, `contracts/GuardMeshAudit.sol`
- **Deployment Info:** `deployments/testnet.json`
- **ABIs:** `artifacts/contracts/*/**.json`
- **Config:** `hardhat.config.js`

---

## 🔄 Next Steps

1. ✅ Contracts deployed and verified
2. ⬜ Integrate with guardian agents (read policy before evaluation)
3. ⬜ Integrate with consensus engine (record decisions)
4. ⬜ Build dashboard UI (read from contracts)
5. ⬜ Test Meta incident scenario end-to-end
6. ⬜ Deploy to mainnet (when ready)

---

## 💡 Key Addresses (Save These!)

```
GuardMeshRegistry: 0x0bfB6f131A99D5aaA3071618FFBD5bb3ea87C619
GuardMeshAudit:    0x522748669646A1a099474cd7f98060968A80E812
Network:           0G Galileo Testnet (16602)
RPC:               https://evmrpc-testnet.0g.ai
Explorer:          https://chainscan-galileo.0g.ai
```

---

## 🆘 Support

- 0G Docs: https://docs.0g.ai
- 0G Discord: https://discord.gg/0glabs
- Contract Issues: Check `deployments/testnet.json` for transaction hashes
