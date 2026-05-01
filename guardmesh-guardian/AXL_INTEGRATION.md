# GuardMesh AXL Integration Guide

This guide explains how to run GuardMesh with the AXL (Agent Exchange Layer) network for distributed guardian consensus.

## Architecture

```
Agent → Intent Broadcaster → AXL Network → 3 Guardian Listeners
                                              ↓
                                         0G Compute (TEE)
                                              ↓
                                         Verdicts → Consensus
```

## Prerequisites

1. AXL node binary built (`axl/node`)
2. 3 private keys generated (`private.pem`, `private-2.pem`, `private-3.pem`)
3. 0G wallet funded and configured in `.env`
4. Node.js dependencies installed

## Step 1: Start AXL Nodes

You need 3 terminals for the 3 guardian nodes:

### Terminal 1 - Guardian Node 1 (Hub)
```powershell
cd axl
.\start-guardian-1.ps1
```
This starts the hub node listening on `tls://127.0.0.1:9001` with API on port `9002`.

### Terminal 2 - Guardian Node 2
```powershell
cd axl
.\start-guardian-2.ps1
```
This starts node 2 peering to node 1, with API on port `9012`.

### Terminal 3 - Guardian Node 3
```powershell
cd axl
.\start-guardian-3.ps1
```
This starts node 3 peering to node 1, with API on port `9022`.

### Verify Connectivity

```powershell
cd axl
python test-nodes.py
```

Expected output:
- All 3 nodes show their public keys
- Each node shows "Connected peers: 1" or more
- Send/recv test passes

## Step 2: Start Guardian Listeners

You need 3 more terminals for the guardian listeners:

### Terminal 4 - Guardian Listener 1
```powershell
cd guardmesh-guardian
node start-guardian-listener.js guardian-1 9002
```

### Terminal 5 - Guardian Listener 2
```powershell
cd guardmesh-guardian
node start-guardian-listener.js guardian-2 9012
```

### Terminal 6 - Guardian Listener 3
```powershell
cd guardmesh-guardian
node start-guardian-listener.js guardian-3 9022
```

### One-shot (Windows): three listener windows

From `guardmesh-guardian`:

```powershell
npm run listeners:windows
```

Or: `powershell -ExecutionPolicy Bypass -File ./start-all-listeners.ps1`

### Hub `/recv` vs GenGuard `Web` (verdict spool)

If a **GuardianListener** runs on the **hub** port (**9002**), it competes with **`POST /api/guardmesh/intent`** for the same AXL queue: both call **`GET /recv`**, and each `Pop()` consumes one message. Verdicts dequeued by the listener are appended to **`guardmesh-guardian/.verdict-spool.ndjson`**. The Next.js intent route **drains that file** each poll tick so verdicts are not lost.

Optional: set **`GUARDMESH_VERDICT_SPOOL_PATH`** on the `Web` server if the spool file is not at the default path next to `Web/`.

### Wire GenGuard `Web` to the same three peers

1. With the **hub** AXL API up (`http://127.0.0.1:9002`), run:

```powershell
cd guardmesh-guardian
npm run print:axl-peers
```

2. Copy the printed `GUARDMESH_GUARDIAN_PEER_IDS=...` line into `Web/.env` or `Web/.env.local` together with `GUARDMESH_AXL_URL=http://127.0.0.1:9002` (see `Web/.env.example`).

Each listener will:
- Initialize the Guardian Agent with 0G Compute
- Connect to its AXL node
- Display its public key
- Start polling for intents

## Step 3: Test Intent Broadcast

In a new terminal:

```powershell
cd guardmesh-guardian
node test-axl-integration.js
```

This will:
1. Discover all 3 guardian nodes
2. Broadcast the Meta incident scenario
3. Collect verdicts from all guardians
4. Display consensus result

Expected output:
```
Broadcasting intent...
✓ Sent to guardian abcd1234... (245 bytes)
✓ Sent to guardian ef567890... (245 bytes)
✓ Sent to guardian 12345678... (245 bytes)

Polling for verdicts...
✓ Received verdict from abcd1234...: BLOCK
✓ Received verdict from ef567890...: BLOCK
✓ Received verdict from 12345678...: BLOCK

📋 Consensus:
  BLOCK: 3
  APPROVE: 0
  ⛔ FINAL DECISION: BLOCKED (3/3 guardians blocked)
```

## Message Formats

### Intent Message (Agent → Guardians)
```json
{
  "type": "guardmesh_intent",
  "timestamp": 1234567890,
  "intent": {
    "agent_id": "eng-assistant-04",
    "action_type": "forum_post",
    "target": "internal-engineering-forum",
    "content": "...",
    "data_touched": ["..."],
    "role_scope": "code_analysis_only"
  }
}
```

### Verdict Message (Guardian → Agent)
```json
{
  "type": "guardmesh_verdict",
  "timestamp": 1234567890,
  "guardian_id": "guardian-1",
  "guardian_key": "abcd1234...",
  "verdict": {
    "verdict": "BLOCK",
    "role_check": "FAIL",
    "permission_check": "N/A",
    "content_check": "PASS",
    "reason": "Action type forum_post does not match code_analysis_only role scope."
  },
  "tee_verified": true
}
```

## Consensus Logic

The consensus engine collects verdicts from all 3 guardians:

- **All 3 BLOCK** → Hard stop, raise incident
- **2 BLOCK, 1 APPROVE** → Hold for human review
- **2 APPROVE, 1 BLOCK** → Execute but flag as contested
- **All 3 APPROVE** → Execute action

## Troubleshooting

### Guardians not receiving intents
- Check all AXL nodes are running and peered
- Verify `Connected peers: 1` or more in each node's log
- Check guardian listeners are running and polling

### Verdicts not returning
- Ensure intent broadcaster is polling with sufficient timeout
- Check guardian listeners successfully evaluated the intent
- Verify no errors in guardian listener logs

### TEE verification failing
- Check 0G wallet has sufficient funds
- Verify provider is accessible: `node axl/0g-check/check-0g.mjs`
- Check `.env` has correct `PRIVATE_KEY`

## Next Steps

- **Phase 5**: Implement consensus engine as a separate service
- **Phase 6**: Add 0G Storage for audit trail
- **Phase 7**: Integrate with smart contracts
- **Phase 8**: Build primary agent wrapper
