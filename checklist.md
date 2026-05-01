GuardMesh — Build Checklist (In Order)

Phase 1 — Environment Setup

 Install Node.js >= 22.0.0
 Clone and build the AXL binary from Gensyn repo
 ✅ AXL 3-node hub mesh configs (`axl/node-config.json`, `node-config-2.json`, `node-config-3.json`)
 ✅ Portable WSL launch scripts (`axl/start-guardian-1.ps1` … `start-guardian-3.ps1` — no hardcoded user path)
 ✅ Mesh verification (`axl/test-nodes.py`, `axl/run-mesh-test.ps1`) — hub **≥2** up peers, spokes **≥1**, B→A and C→A send/recv
 🔄 **You run:** Terminal 1 hub → Terminal 2 spoke B → Terminal 3 spoke C, then `cd axl; .\run-mesh-test.ps1` until checks PASS
 
 📖 Runbook: `axl/README.md` (two-node + three-node hub section) · Keys: `python axl/generate-keys.py` → `private.pem`, `private-2.pem`, `private-3.pem`
 Set up 0G wallet with testnet tokens
 Install @0glabs/0g-serving-broker
 Connect to 0G Galileo testnet (https://evmrpc-testnet.0g.ai)
 Fund 0G account (minimum 3 0G) and transfer to provider (minimum 1 0G)
 Verify qwen-2.5-7b-instruct provider on testnet is accessible


Phase 2 — Smart Contracts

 ✅ Write GuardMeshRegistry.sol
   ✅ registerAgent() function
   ✅ updatePolicy() function
   ✅ getPolicy() function
 ✅ Write GuardMeshAudit.sol
   ✅ recordDecision() function
   ✅ getDecision() function
   ✅ getAgentHistory() function
 ✅ Deploy both contracts to 0G Galileo testnet
 ✅ Save both deployed contract addresses
 🔄 Verify contracts on 0G explorer
 
 📁 Contracts: 0g-contracts/contracts/
 📋 Deployment Info: 0g-contracts/deployments/testnet.json
 📖 Integration Guide: 0g-contracts/DEPLOYMENT_SUMMARY.md
 
 🔗 GuardMeshRegistry: 0x0bfB6f131A99D5aaA3071618FFBD5bb3ea87C619
 🔗 GuardMeshAudit:    0x522748669646A1a099474cd7f98060968A80E812
 🌐 Explorer: https://chainscan-galileo.0g.ai


Phase 3 — AXL Intent Layer

 ✅ Write intent broadcast function
   ✅ Agent sends JSON intent to localhost:9002 via HTTP POST
   ✅ Fields: agent_id, action_type, target, content, data_touched, role_scope
 ✅ Write A2A message format for intent
 ✅ Write A2A message format for verdict response
 ✅ Create guardian listener for receiving intents via AXL
 ✅ Create startup scripts for 3 AXL nodes
 🔄 Test intent broadcast reaches all 3 guardian nodes
 🔄 Test verdict messages travel back over AXL to consensus engine
 🔄 Confirm end-to-end AXL mesh works with guardian evaluation
 
 📁 Implementation: guardmesh-guardian/axl-*.js
 📖 Setup Guide: guardmesh-guardian/AXL_INTEGRATION.md
 🚀 Quick Start: START_GUARDMESH.md
 🧪 Test: npm run test:axl (after starting nodes and listeners)
 
 ⚠️  READY TO TEST - Start 3 AXL nodes + 3 guardian listeners, then run test


Phase 4 — Guardian Agent Logic

 ✅ Write GUARDIAN_SYSTEM_PROMPT with 3 checks (role, permission, content)
 ✅ Force JSON output format in prompt:

json  {
    "role_check": "PASS" | "FAIL",
    "permission_check": "PASS" | "FAIL",
    "content_check": "PASS" | "FAIL",
    "verdict": "APPROVE" | "BLOCK",
    "reason": "one sentence"
  }

 ✅ Initialise 0G Compute broker with testnet RPC
 ✅ Call getServiceMetadata() to get qwen-2.5-7b-instruct endpoint
 ✅ Call getRequestHeaders() for auth
 ✅ Send intent payload to qwen-2.5-7b-instruct via 0G Compute
 ✅ Call processResponse() with ZG-Res-Key header to verify TEE attestation
 ✅ Parse guardian JSON verdict from response
 ✅ Attach teeVerified: true/false to verdict object
 ✅ Test guardian with Meta incident scenario - PASSED
 🔄 Wire all 3 guardians to receive intent from AXL and return verdict over AXL
 
 📁 Implementation: guardmesh-guardian/guardian.js (fully working)
 📖 Setup Guide: guardmesh-guardian/SETUP.md
 🧪 Test: cmd /c test.bat (working with TEE verification)
 
 ✅ PHASE 4 COMPLETE - Guardian successfully blocks policy violations with TEE proof


Phase 5 — Consensus Engine

 ✅ Collect all 3 guardian verdicts (via `pollVerdicts` + `consensus` on `POST /api/guardmesh/intent`)
 ✅ Implement consensus logic (`Web/lib/guardmesh-consensus.ts`):

 All 3 approve → execute action
 2 approve, 1 blocks → execute but flag as contested
 2 block → hold for human review
 All 3 block → hard stop, raise incident


 ✅ Make consensus threshold configurable (`phase5` / `unanimous` / `majority` / `any` + env `GUARDMESH_CONSENSUS_THRESHOLD`, body `consensus_threshold`, `thresholdCode` in response)
 ✅ Return final decision to the primary agent (`consensus.finalDecision` + bridge stderr + `--strict-final`; OpenClaw skill updated)


Phase 6 — 0G Storage + Chain Audit Trail

 ✅ Install @0gfoundation/0g-ts-sdk (Web) — Turbo indexer + `MemData` per 0G Storage TS docs
 ✅ After every decision (`POST /api/guardmesh/intent` when `GUARDMESH_PHASE6_ANCHOR=1`), bundle full event:

 Original intent payload
 All 3 guardian verdicts + reasons
 TEE verification status per guardian
 Final consensus outcome
 Timestamp


 ✅ Upload bundle to 0G Storage (`Indexer.upload`) — optional SDK symmetric encryption via `GUARDMESH_STORAGE_SYMMETRIC_KEY_HEX` (32-byte hex)
 ✅ Merkle root from `merkleTree()` (same root anchored on-chain)
 ✅ Call `recordDecision()` on `GuardMeshAudit.sol` with that merkle root (`phase6_audit` in JSON + explorer links)
 ✅ Confirm transactions on Galileo explorer (`chain.explorerUrl`, `storage.explorerUrl` in `phase6_audit`)


Phase 7 — 0G KV Store (Policy Layer)

 ✅ Store agent policy in 0G KV — `POST /api/guardmesh/kv-policy` (TS SDK `Batcher` + indexer, same class of path as CLI `kv-write`)
 ✅ Key = UTF-8 `agent_id`, value = JSON (`KvPolicyRecord`: allowed/denied/sources, threshold, `active`, …)
 ✅ Policies UI: `POST /api/guardmesh/kv-sync` after register / update / deactivate / reactivate — **chain `getPolicy` → 0G KV** (needs local tool secret + `GUARDMESH_TOOL_SECRET` + `GUARDMESH_KV_WRITER_PRIVATE_KEY`)

 ✅ Guardians: `getPolicyFromKv()` — when `GUARDMESH_KV_NODE_URL` is set, `registry-policy-gate.mjs` **requires** 0G KV for policy fields (missing key → BLOCK); no chain `getPolicy` fallback in that mode. Unset URL → chain `getPolicy` for dev only (still requires agent registered+active on-chain)
 ✅ Read-back: `GET /api/guardmesh/kv-policy?agent_id=` (KV node via `KvClient`, same role as CLI `kv-read`)

 Optional: mirror policies with `0g-storage-client kv-write` using the same stream id + keys if you prefer ops CLI over the Web API.


Phase 8 — Primary Agent Integration

 Pick primary agent for demo (LangChain recommended)
 Write guardmesh_tool_wrapper middleware

 Intercepts every tool call before execution
 Broadcasts intent to AXL
 Waits for consensus verdict
 Executes if approved / blocks if rejected


 Test wrapper with a simple tool call (read file, query DB)
 Test wrapper correctly blocks a policy-violating tool call


Phase 9 — Dashboard UI (Next.js)

 Set up Next.js project
 Page 1 — Activity Feed

 Real-time event stream from AXL
 Colour-coded rows (red/amber/green)
 Detail panel on row click (intent + verdicts + 0G receipt link)


 Page 2 — Guardians

 AXL node list with public keys
 Online status, vote count, uptime, block rate
 Live heartbeat status


 Page 3 — Audit Trail

 Pull historical decisions from 0G Storage
 Filter by All / Blocked / Approved / Pending
 Search by agent ID, date, action type
 Expandable rows with full event + merkle root + chain link


 Page 4 — Policy Editor

 Per-agent policy cards
 Allowed / denied action tags
 Consensus threshold dropdown
 Save button writes to 0G KV Store




Phase 10 — Demo Scenario

 Register eng-assistant-04 agent with scope code_analysis_only
 Set policy: denied actions = forum_post, change_permissions
 Script the Meta incident scenario:

 Agent receives analysis request
 Agent tries to post to forum autonomously
 Intent broadcast fires over AXL
 Guardian 1 → role check FAIL
 Guardian 2 → permission check FAIL
 Guardian 3 → content check result
 Consensus → BLOCKED
 Audit record written to 0G Storage + chain


 Run Scene 1 without GuardMesh (show breach)
 Run Scene 2 with GuardMesh (show block)
 Confirm 0G chain explorer shows the decision record