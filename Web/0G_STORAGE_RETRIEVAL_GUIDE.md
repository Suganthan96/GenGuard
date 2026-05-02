# 0G Storage Retrieval Guide

Complete guide for retrieving and verifying decision bundles from 0G Storage.

## Overview

GuardMesh stores two types of data in the 0G ecosystem:

1. **Agent Policies** → **0G KV Store** (fast key-value access for guardians)
2. **Decision Bundles** → **0G Storage** (immutable audit trail with merkle root anchored on-chain)

This guide covers **retrieving decision bundles from 0G Storage**.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Decision Flow                             │
└─────────────────────────────────────────────────────────────┘

1. Agent Intent → Guardians evaluate → Verdicts collected
2. Consensus computed → Decision bundle created
3. Bundle uploaded to 0G Storage → Merkle root returned
4. Merkle root anchored on GuardMeshAudit smart contract
5. Later: Retrieve bundle using merkle root → Verify against chain

┌──────────────┐
│ Intent + │
│ Verdicts + │  ──┐
│ Consensus  │    │
└──────────────┘    │
                    ▼
            ┌───────────────┐
            │  0G Storage   │
            │   (Upload)    │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │  Merkle Root  │
            └───────┬───────┘
                    │
                    ▼
        ┌──────────────────────┐
        │ GuardMeshAudit.sol   │
        │  recordDecision()    │
        └──────────────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │   On-Chain Record    │
        │  (immutable anchor)  │
        └──────────────────────┘

        Later retrieval:
                    │
                    ▼
        ┌──────────────────────┐
        │  Merkle Root Lookup  │
        └───────┬──────────────┘
                │
                ▼
        ┌───────────────┐
        │  0G Storage   │
        │  (Download)   │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Decrypt (if   │
        │  encrypted)   │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Verify against│
        │  on-chain data│
        └───────────────┘
```

## Decision Bundle Structure

```typescript
{
  schemaVersion: 1,
  decidedAtIso: "2026-05-01T12:34:56.789Z",
  decidedAtUnix: 1746098096,
  encryption: "none" | "symmetric_aes256_ctr_v1",
  
  intent: {
    agent_id: "eng-assistant-04",
    action_type: "forum_post",
    target: "internal-engineering-forum",
    content: "...",
    data_touched: ["user_metrics_table"],
    role_scope: "code_analysis_only"
  },
  
  verdicts: [
    {
      peerId: "62bcea25...",
      verdict: "BLOCK",
      role_check: "FAIL",
      permission_check: "N/A",
      content_check: "PASS",
      reason: "Action type forum_post does not match code_analysis_only role scope",
      tee_verified: true
    },
    // ... 2 more verdicts
  ],
  
  teeVerification: [
    { peer_id: "62bcea25...", tee_verified: true },
    { peer_id: "5343e94f...", tee_verified: true },
    { peer_id: "588e9c92...", tee_verified: true }
  ],
  
  consensus: {
    execute: false,
    outcomeCode: 3,
    approveCount: 0,
    blockCount: 3,
    rationale: "All 3 guardians blocked",
    finalDecision: {
      action: "block",
      agentInstruction: "Action blocked by unanimous guardian decision"
    }
  },
  
  sendResults: { /* AXL send metadata */ }
}
```

## Retrieval Process

### Step 1: Get Merkle Root

The merkle root is returned when a decision is recorded. You can find it:

1. **From the intent API response** (when Phase 6 is enabled):
   ```json
   {
     "phase6_audit": {
       "ok": true,
       "merkleRoot": "0xabcd1234...",
       "storage": { "txHash": "0x...", "explorerUrl": "..." },
       "chain": { "recordTxHash": "0x...", "explorerUrl": "..." }
     }
   }
   ```

2. **From the Audit Trail UI** (`/home/audit`):
   - Browse paginated decisions
   - Each row shows the merkle root

3. **From on-chain events**:
   - Listen to `DecisionRecorded` events on GuardMeshAudit
   - Extract `merkleRoot` from event data

### Step 2: Retrieve Bundle

#### Via API

```bash
curl "http://localhost:3000/api/guardmesh/retrieve-bundle?merkleRoot=0xabcd1234..."
```

**Response (success)**:
```json
{
  "ok": true,
  "merkleRoot": "0xabcd1234...",
  "bundle": { /* full decision bundle */ },
  "onChainData": {
    "agentId": "eng-assistant-04",
    "approved": false,
    "outcome": 3,
    "actionType": "forum_post",
    "target": "internal-engineering-forum",
    "approveCount": 0,
    "blockCount": 3,
    "blockedReason": "...",
    "intentTimestamp": "1746098096",
    "recordedAt": "1746098100",
    "recorder": "0x588F6b..."
  },
  "verified": true,
  "verificationNotes": [
    "All fields match on-chain data",
    "Successfully decrypted with symmetric key"
  ]
}
```

**Response (error)**:
```json
{
  "ok": false,
  "stage": "on_chain" | "download" | "decrypt" | "parse" | "verify",
  "error": "Error message"
}
```

#### Via UI

1. Go to **Audit Trail** page (`/home/audit`)
2. Enter merkle root in the lookup field
3. Click **"getDecision"** to see on-chain data
4. Click **"Retrieve Bundle"** to fetch from 0G Storage
5. View expandable sections:
   - Intent
   - Verdicts (with TEE verification status)
   - Consensus
   - TEE Verification summary
   - Full Bundle (raw JSON)

### Step 3: Verification

The retrieval function automatically verifies the bundle against on-chain data:

**Checks performed**:
- ✓ Agent ID matches
- ✓ Action type matches
- ✓ Target matches
- ✓ Approve count matches
- ✓ Block count matches
- ✓ Execution decision matches

If any check fails, `verified: false` and `verificationNotes` will explain the mismatch.

## Encryption

Bundles can be encrypted with AES-256-CTR for privacy.

### Enable Encryption

Set in `Web/.env.local`:
```bash
# 32-byte hex key (64 hex characters)
GUARDMESH_STORAGE_SYMMETRIC_KEY_HEX=0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab
```

### Decryption

The retrieval function automatically decrypts if:
1. Data doesn't start with `{` (not valid JSON)
2. `GUARDMESH_STORAGE_SYMMETRIC_KEY_HEX` is set

**Decryption process**:
- First 16 bytes = IV (initialization vector)
- Remaining bytes = encrypted data
- Decrypt using AES-256-CTR with the symmetric key

## Environment Variables

### Required for Upload (Phase 6)

```bash
# Enable Phase 6 (0G Storage + on-chain anchoring)
GUARDMESH_PHASE6_ANCHOR=1

# Private key for recordDecision transactions
GUARDMESH_AUDIT_RECORDER_PRIVATE_KEY=0x...

# Optional: Encrypt bundles
GUARDMESH_STORAGE_SYMMETRIC_KEY_HEX=0x...
```

### Required for Retrieval

```bash
# Same symmetric key used for upload (if encrypted)
GUARDMESH_STORAGE_SYMMETRIC_KEY_HEX=0x...

# Optional: Custom indexer URL
GUARDMESH_0G_STORAGE_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai

# Optional: Custom RPC URL
GUARDMESH_0G_EVM_RPC_URL=https://evmrpc-testnet.0g.ai
```

## Use Cases

### 1. Audit Investigation

When investigating why an action was blocked:

1. Find the merkle root from the audit trail
2. Retrieve the full bundle
3. Review:
   - Original intent details
   - Each guardian's verdict and reasoning
   - TEE verification status
   - Consensus logic applied

### 2. Compliance Reporting

Generate compliance reports with full decision history:

```typescript
// Fetch all decisions from on-chain
const decisions = await auditContract.getAllDecisionsPaginated(0, 100)

// Retrieve bundles for detailed analysis
for (const decision of decisions) {
  const bundle = await fetch(`/api/guardmesh/retrieve-bundle?merkleRoot=${decision.merkleRoot}`)
  // Analyze verdicts, TEE status, etc.
}
```

### 3. Dispute Resolution

If a decision is contested:

1. Retrieve the bundle
2. Verify all verdicts have TEE verification
3. Check if consensus rules were applied correctly
4. Review guardian reasoning for each verdict

### 4. Guardian Performance Analysis

Analyze guardian behavior over time:

```typescript
const bundles = await Promise.all(
  merkleRoots.map(root => 
    fetch(`/api/guardmesh/retrieve-bundle?merkleRoot=${root}`)
  )
)

// Analyze:
// - Which guardians blocked most often
// - TEE verification success rate
// - Average response time
// - Reasoning patterns
```

## Error Handling

### Common Errors

| Stage | Error | Solution |
|-------|-------|----------|
| `config` | Invalid merkle root format | Ensure 0x + 64 hex characters |
| `on_chain` | No decision found | Verify merkle root is correct and decision was recorded |
| `download` | 0G Storage download failed | Check indexer URL and network connectivity |
| `decrypt` | Decryption failed | Verify `GUARDMESH_STORAGE_SYMMETRIC_KEY_HEX` matches upload key |
| `parse` | JSON parse failed | Data may be corrupted or wrong decryption key |
| `verify` | Field mismatch | Bundle may have been tampered with (check verification notes) |

### Debugging

Enable detailed logging:

```typescript
// In Web/lib/guardmesh-phase6-retrieval.ts
console.log("Downloading from:", indexerUrl)
console.log("Merkle root:", merkleRoot)
console.log("Downloaded bytes:", downloadedBytes.length)
console.log("Decryption needed:", !rawText.trim().startsWith("{"))
```

## Security Considerations

1. **Merkle Root Integrity**: Always verify the merkle root exists on-chain before trusting the bundle
2. **Verification Required**: Check `verified: true` in the response
3. **TEE Status**: Review `teeVerification` to ensure guardians used TEE
4. **Key Management**: Keep `GUARDMESH_STORAGE_SYMMETRIC_KEY_HEX` secure (never commit to git)
5. **On-Chain Anchor**: The on-chain record is the source of truth; 0G Storage provides the details

## Implementation Files

- `Web/lib/guardmesh-phase6-anchor.ts` - Upload to 0G Storage
- `Web/lib/guardmesh-phase6-retrieval.ts` - Download from 0G Storage
- `Web/app/api/guardmesh/retrieve-bundle/route.ts` - API endpoint
- `Web/app/home/audit/page.tsx` - UI for retrieval

## Next Steps

- **Phase 7**: Integrate 0G KV Store for policy retrieval by guardians
- **Phase 8**: Build primary agent wrapper that checks decisions before execution
- **Phase 9**: Enhanced dashboard with bundle visualization
- **Phase 10**: Demo scenario with full audit trail

---

**Status**: ✅ 0G Storage retrieval fully implemented and ready for testing
