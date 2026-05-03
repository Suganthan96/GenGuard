# GenGuard / GuardMesh

Decentralized governance and safety layer for AI agents using guardian consensus, on-chain policy, ENS identity, and immutable audit on 0G.

## Problem

Autonomous agents in production face four hard trust problems:

- No deterministic policy gate before action execution
- No multi-party consensus for risky operations
- No tamper-proof replay/audit trail for decisions
- No strong, portable identity layer for agents/guardians

## Solution

GuardMesh adds a governance fabric around agent actions:

- **Policy-first execution** via `GuardMeshRegistry` / `GuardMeshRegistryENS`
- **Guardian mesh consensus** over intents before tool execution
- **Immutable audit anchoring** via `GuardMeshAudit` + 0G Storage bundles
- **Identity layer** via ENS registration + ENS linkage on registry
- **KV mirroring** so guardians can read latest policy consistently

## Deployed Contracts (0G Galileo Testnet, Chain ID 16602)

From `0g-contracts/deployments/testnet.json` and `0g-contracts/deployments/testnet-ens.json`:

- **GuardMeshRegistry**: `0x0bfB6f131A99D5aaA3071618FFBD5bb3ea87C619`
- **GuardMeshAudit**: `0x522748669646A1a099474cd7f98060968A80E812`
- **GuardMeshRegistryENS**: `0x0925e20438AF659048643Ce747aEe38A7b916E54`

Recommended active registry in web app:

- `NEXT_PUBLIC_REGISTRY_ADDRESS=0x0925e20438AF659048643Ce747aEe38A7b916E54`

## Contract Roles

- **GuardMeshRegistry**
  - Registers agent policy (`agentId`, `roleScope`, `allowedActions`)
  - Updates/deactivates/reactivates policy state
  - Source of truth for policy authorization

- **GuardMeshAudit**
  - Records final decision root + outcome metadata
  - Immutable, replayable audit receipt for each governed action

- **GuardMeshRegistryENS**
  - Extends registry with ENS identity mapping
  - Stores ENS name, namehash node, resolved address, metadata cache
  - Supports `assignENSName` / `registerAgentWithENS`

## High-Level Architecture

```mermaid
flowchart LR
    A[Client / Agent Request] --> B[Web Policy + Intent API]
    B --> C[Guardians via AXL Mesh]
    C --> D[Consensus Result]
    D --> E[Tool Execution Gate]
    D --> F[Decision Bundle]
    F --> G[0G Storage]
    D --> H[GuardMeshAudit on 0G EVM]
    B --> I[GuardMeshRegistryENS]
    I --> J[0G KV Policy Mirror]
    K[Sepolia ENS] --> I
```

## Registration + Governance Sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Web UI)
    participant W as Web App
    participant R as GuardMeshRegistryENS (0G)
    participant KV as 0G KV Sync API
    participant ENS as Sepolia ENS Registrar

    U->>W: Register agentId (e.g. myagent.eth)
    W->>R: registerAgent(agentId, roleScope, allowedActions)
    R-->>W: tx confirmed
    W->>KV: POST /api/guardmesh/kv-sync (agent_id)
    KV-->>W: policy mirrored to 0G KV
    alt agentId endsWith .eth
      W->>ENS: commit + register name on Sepolia
      ENS-->>W: name registered / already registered
      W->>R: assignENSName(agentId, ensName, owner)
      R-->>W: ENS linked on 0G
    end
    W-->>U: Registration complete
```

## Intent Decision Sequence

```mermaid
sequenceDiagram
    autonumber
    participant A as Agent / Client
    participant API as /api/guardmesh/intent
    participant G1 as Guardian 1
    participant G2 as Guardian 2
    participant G3 as Guardian 3
    participant AUD as GuardMeshAudit
    participant S as 0G Storage

    A->>API: Submit intent + policy context
    API->>G1: evaluate_intent
    API->>G2: evaluate_intent
    API->>G3: evaluate_intent
    G1-->>API: verdict
    G2-->>API: verdict
    G3-->>API: verdict
    API->>API: Compute consensus
    API->>S: Upload decision bundle
    S-->>API: merkle/root metadata
    API->>AUD: recordDecision(...)
    AUD-->>API: tx receipt
    API-->>A: approved/blocked + audit refs
```

## ENS in This Project

ENS is used in two distinct layers:

1. **Real ENS registration on Sepolia**  
   For `*.eth` names, Web API (`/api/guardmesh/ens-register`) performs commit-reveal registration.

2. **Registry-level identity linkage on 0G**  
   After registration, `assignENSName` links agent policy identity to ENS metadata on `GuardMeshRegistryENS`.

Important: linking ENS on 0G registry is not the same as minting/registering a `.eth` name. Both are handled in sequence.

## Core Components

- `Web/`  
  Next.js dashboard + APIs (policy editor, intent API, kv sync, ens registration route)

- `0g-contracts/`  
  Solidity contracts + deployment artifacts for registry, audit, ENS-enabled registry

- `guardmesh-guardian/`  
  Guardian runtime, ENS utilities, KV policy readers, LLM adapters

- `axl/`  
  AXL communication substrate for guardian message exchange

## Environment Notes (Web)

Critical variables:

- `NEXT_PUBLIC_REGISTRY_ADDRESS` (use ENS registry address above)
- `NEXT_PUBLIC_AUDIT_ADDRESS`
- `GUARDMESH_TOOL_SECRET` and `NEXT_PUBLIC_GUARDMESH_TOOL_SECRET`
- `ENS_REGISTRAR_PRIVATE_KEY` (required for real Sepolia ENS registration)
- `GUARDMESH_KV_STREAM_ID` and KV writer keys

## Local Run

```bash
cd Web
pnpm install
pnpm dev
```

Open:

- `http://localhost:3000`
- Policy editor: `http://localhost:3000/home/policies`

## Deployment

Deploy `Web` as Vercel project root.

- Root Directory: `Web`
- Framework: Next.js
- Add required env vars in Vercel Project Settings

## Security Notes

- Never commit production private keys
- Rotate any exposed test keys before public demos
- Keep tool secrets and registrar keys in environment managers (not source files)

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

Built on 0G Galileo with ENS-enabled identity and guardian consensus governance.
