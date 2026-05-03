# GenGuard / GuardMesh

GenGuard is a decentralized governance and safety layer for autonomous AI agents.  
It combines on-chain policy, multi-guardian consensus over Gensyn AXL, ENS-based identity, and immutable audit on 0G.

## Problem

Production AI agents now execute real actions (read/write data, call APIs, run tools, change configuration), but most systems still rely on centralized trust assumptions.

Key gaps we address:

1. No deterministic gate before high-risk execution  
Most agent stacks allow action execution after a single backend check, which can fail open or be bypassed.

2. Single-point policy control  
If one policy server or one operator is compromised, unsafe actions may still pass.

3. Poor incident replayability  
Teams cannot reliably prove who requested what, who approved it, and which policy version was used.

4. Weak identity layer  
Opaque agent IDs are hard to audit across systems; identity is often not portable or human-readable.

5. Inconsistent policy propagation  
Different enforcement nodes can evaluate against stale or different policy snapshots.

## Solution

GenGuard enforces a deterministic, decentralized governance pipeline:

1. Policy-first registration on 0G contracts  
Every agent is registered with role scope and allowed actions in `GuardMeshRegistry` / `GuardMeshRegistryENS`.

2. Consensus-based action control over Gensyn AXL  
Before execution, intents are broadcast to 3 guardian nodes. Final action depends on threshold consensus (approve/block/hard-stop).

3. Consistent policy reads via 0G KV mirror  
On-chain policy is mirrored into 0G KV so all guardians evaluate against the same state.

4. Human-readable identity via ENS  
For `.eth` agent IDs, ENS registration/linkage maps governance decisions to portable names (for example `myagentmeta.eth`).

5. Immutable audit trail on 0G  
Decision bundles are persisted to 0G Storage and anchored through `GuardMeshAudit` with verifiable tx/root references.

## Deployed Contracts (0G Galileo Testnet, Chain ID 16602)

From `0g-contracts/deployments/testnet.json` and `0g-contracts/deployments/testnet-ens.json`:

- `GuardMeshRegistry`: `0x0bfB6f131A99D5aaA3071618FFBD5bb3ea87C619`
- `GuardMeshAudit`: `0x522748669646A1a099474cd7f98060968A80E812`
- `GuardMeshRegistryENS`: `0x0925e20438AF659048643Ce747aEe38A7b916E54`

Recommended active registry for web/guardians:

- `NEXT_PUBLIC_REGISTRY_ADDRESS=0x0925e20438AF659048643Ce747aEe38A7b916E54`

## Contract Responsibilities

### GuardMeshRegistry

- Registers policy tuple: `agentId`, `roleScope`, `allowedActions`
- Supports policy lifecycle updates/deactivation/reactivation
- Primary policy source of truth for authorization

### GuardMeshAudit

- Anchors final consensus outcome + metadata
- Stores immutable references for replayable governance audit

### GuardMeshRegistryENS

- Extends registry with ENS identity mapping
- Stores ENS name, namehash node, resolved owner/address metadata
- Supports ENS linkage methods such as `assignENSName` / `registerAgentWithENS`

## End-to-End Architecture

```mermaid
sequenceDiagram
    autonumber
    participant U as User Wallet / Client
    participant UI as Web UI (Next.js)
    participant API as GuardMesh API Layer
    participant REG as RegistryENS (0x0925...E54)
    participant KV as 0G KV Mirror
    participant ENS as Sepolia ENS
    participant G1 as Guardian 1
    participant G2 as Guardian 2
    participant G3 as Guardian 3
    participant ST as 0G Storage
    participant AUD as Audit (0x5227...E812)

    rect rgb(20, 28, 45)
    Note over U,AUD: Registration + Identity Bootstrap
    U->>UI: Submit agentId (example: myagent.eth), role, actions
    UI->>API: register request
    API->>REG: registerAgent(agentId, roleScope, allowedActions)
    REG-->>API: tx confirmed
    API->>KV: kv-sync (mirror on-chain policy)
    KV-->>API: rootHash + txHash
    alt agentId ends with .eth
      API->>ENS: commit + register (Sepolia)
      ENS-->>API: registered/already registered
      API->>REG: assignENSName(agentId, ensName, owner)
      REG-->>API: ENS linked on 0G
    end
    API-->>UI: registration complete
    end

    rect rgb(20, 28, 45)
    Note over U,AUD: Governed Intent Execution
    U->>UI: Request risky action / tool execution
    UI->>API: POST intent + context
    API->>REG: read policy for agentId
    API->>G1: evaluate_intent
    API->>G2: evaluate_intent
    API->>G3: evaluate_intent
    G1-->>API: verdict
    G2-->>API: verdict
    G3-->>API: verdict
    API->>API: compute consensus + action gate
    API->>ST: upload decision bundle
    ST-->>API: merkle root / storage receipt
    API->>AUD: recordDecision(...)
    AUD-->>API: tx receipt
    API-->>UI: approved/blocked + replay refs
    end
```

## 0G Integration (What We Use + Where)

### What 0G is used for

- 0G EVM: on-chain policy and audit contracts
- 0G KV: mirrored policy state for guardian reads
- 0G Storage: decision bundle persistence

### Code locations

- Contracts and deployments  
  - `0g-contracts/contracts/GuardMeshRegistry.sol`
  - `0g-contracts/contracts/GuardMeshRegistry-ENS.sol`
  - `0g-contracts/contracts/GuardMeshAudit.sol`
  - `0g-contracts/deployments/testnet.json`
  - `0g-contracts/deployments/testnet-ens.json`

- Web registration + KV sync path  
  - `Web/app/home/policies/page.tsx`
  - `Web/app/api/guardmesh/kv-sync/route.ts`
  - `Web/app/api/guardmesh/intent/route.ts`

- Guardian KV policy path  
  - `guardmesh-guardian/kv-policy-get.mjs`
  - `guardmesh-guardian/kv-stream-id-normalize.mjs`

## Gensyn Integration (What We Use + Where)

### What Gensyn is used for

- Peer-to-peer guardian communication over AXL
- Distributed verdict collection for consensus
- Removal of centralized safety decision server

### Code locations

- Guardian runtime and AXL flow  
  - `guardmesh-guardian/guardian.js`
  - `guardmesh-guardian/start-guardian-listener.js`
  - `guardmesh-guardian/start-all-listeners.ps1`
  - `axl/` (AXL integration assets and setup)

- Web/API intent dispatch and consensus entry  
  - `Web/app/api/guardmesh/intent/route.ts`
  - `Web/lib/guardmesh.ts`

## ENS Integration (What We Use + Where)

### What ENS is used for

- Human-readable identity for agents and governance attribution
- `.eth` registration/link flow during agent onboarding
- ENS-to-registry linkage for policy identity verification

### Code locations

- ENS registration API + UI trigger  
  - `Web/app/api/guardmesh/ens-register/route.ts`
  - `Web/app/home/policies/page.tsx`

- ENS-aware registry contract  
  - `0g-contracts/contracts/GuardMeshRegistry-ENS.sol`

- Guardian ENS tooling and bootstrapping  
  - `guardmesh-guardian/ens-utils.mjs`
  - `guardmesh-guardian/guardian-ens-boot.mjs`

## Agent Registration Flow (Detailed)

When a user registers an agent in Policy Editor:

1. Web submits policy to `GuardMeshRegistryENS` on 0G.
2. After tx confirmation, Web calls `/api/guardmesh/kv-sync` to mirror policy to 0G KV.
3. If `agentId` is `.eth`, Web calls `/api/guardmesh/ens-register` for ENS registration/link.
4. Guardians consume mirrored policy and identity in intent-time checks.

This ensures policy, storage, and identity are aligned before governed execution.

## Intent Governance Flow (Detailed)

For each high-risk action:

1. Client submits intent + context to `/api/guardmesh/intent`.
2. API loads policy and broadcasts evaluation request to guardian nodes over AXL.
3. Guardians return verdict payloads independently.
4. Consensus engine computes final outcome:
   - `approve` -> action may execute
   - `block` -> action denied
   - `hard_stop_incident` -> deny + escalate to human
5. API writes decision bundle to 0G Storage and records anchor metadata on `GuardMeshAudit`.
6. Response includes final decision and replay references.

## Repository Components

- `Web/`  
  Next.js dashboard + APIs (wallet flow, policies, intent, kv-sync, ens-register)

- `0g-contracts/`  
  Solidity contracts, deploy scripts, and deployment artifacts

- `guardmesh-guardian/`  
  Guardian runtime, ENS utilities, KV policy readers, model adapters

- `axl/`  
  AXL/Gensyn communication layer and related setup

## Environment Notes

Critical web variables:

- `NEXT_PUBLIC_0G_RPC_URL`
- `NEXT_PUBLIC_REGISTRY_ADDRESS`
- `NEXT_PUBLIC_AUDIT_ADDRESS`
- `GUARDMESH_TOOL_SECRET`
- `NEXT_PUBLIC_GUARDMESH_TOOL_SECRET`
- `ENS_REGISTRAR_PRIVATE_KEY`
- `GUARDMESH_KV_STREAM_ID`

Critical guardian variables:

- `GUARDMESH_REGISTRY_ADDRESS`
- `GUARDMESH_POLICY_SOURCE`
- `GUARDMESH_KV_STREAM_ID`
- `GUARDMESH_KV_NODE_URL`
- `AXL_API_URL`
- `GUARDIAN_ID`

## Local Run

```bash
cd Web
pnpm install
pnpm dev
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/home/policies`
- `http://localhost:3000/home/analyze`

## Deployment

Deploy `Web` as the Vercel project root:

- Root Directory: `Web`
- Framework preset: Next.js
- Add all required environment variables in Vercel Project Settings

## Security Notes

- Do not commit production private keys
- Rotate exposed test keys before public demo
- Keep registrar/tool secrets in env manager (not source files)
- Use isolated wallets for ENS registrar and audit recorder roles

## Optional Package/Distribution Note

GenGuard components are modularized for reuse and can be distributed through npm-style packaging for external integration into existing agent systems.

## Repository Layout

```text
GenGuard/
├─ Web/                    # Dashboard + APIs
├─ 0g-contracts/           # Solidity + deployments
├─ guardmesh-guardian/     # Guardian logic + ENS/KV helpers
├─ axl/                    # Guardian mesh transport
└─ integrations/           # Integrations and adapters
```

---

Built on 0G Galileo with Gensyn guardian consensus and ENS-enabled agent identity.
