# GuardMesh Architecture

## System Overview

GuardMesh is a decentralized governance framework for AI agents built on the 0G network. It provides policy enforcement, TEE-verified decisions, and immutable audit trails.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Web UI     │  │  CLI Tool    │  │  SDK/API     │         │
│  │  (Next.js)   │  │  (Node.js)   │  │ (TypeScript) │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                    Integration Layer                             │
│                            │                                      │
│  ┌─────────────────────────▼──────────────────────────┐         │
│  │         GuardMesh Agent Framework                   │         │
│  │  • Intent Submission                                │         │
│  │  • Policy Validation                                │         │
│  │  • Result Processing                                │         │
│  └─────────────────────────┬──────────────────────────┘         │
└────────────────────────────┼─────────────────────────────────────┘
                             │
          ┌──────────────────┴──────────────────┐
          │                                     │
┌─────────▼─────────────┐          ┌───────────▼──────────────┐
│   Guardian Mesh       │          │   Smart Contracts        │
│   (AXL P2P Network)   │◄────────►│   (0G EVM)              │
│                       │          │                          │
│  ┌─────────────────┐ │          │  ┌────────────────────┐ │
│  │  Guardian Node  │ │          │  │ Registry Contract  │ │
│  │  • Policy Check │ │          │  │ • Agent Policies   │ │
│  │  • TEE Verify   │ │          │  │ • Permissions      │ │
│  │  • Vote         │ │          │  └────────────────────┘ │
│  └─────────────────┘ │          │                          │
│                       │          │  ┌────────────────────┐ │
│  ┌─────────────────┐ │          │  │  Audit Contract    │ │
│  │  Guardian Node  │ │          │  │ • Decisions        │ │
│  │  • Policy Check │ │          │  │ • Merkle Roots     │ │
│  │  • TEE Verify   │ │          │  │ • History          │ │
│  │  • Vote         │ │          │  └────────────────────┘ │
│  └─────────────────┘ │          │                          │
│                       │          │  ┌────────────────────┐ │
│  ┌─────────────────┐ │          │  │  ENS Integration   │ │
│  │  Guardian Node  │ │          │  │ • Guardian Names   │ │
│  │  • Policy Check │ │          │  │ • Resolution       │ │
│  │  • TEE Verify   │ │          │  └────────────────────┘ │
│  │  • Vote         │ │          └──────────────────────────┘
│  └─────────────────┘ │
└───────┬───────────────┘
        │
        │ TEE Inference
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      0G Compute Layer                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  TEE-Verified Inference                                │    │
│  │  • Model: qwen-2.5-7b-instruct                        │    │
│  │  • Sealed Execution                                    │    │
│  │  • Cryptographic Proof                                 │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ Store Bundle
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      0G Storage Layer                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Immutable Audit Trail                                 │    │
│  │  • Intent Payload                                      │    │
│  │  • Guardian Verdicts                                   │    │
│  │  • Verification Proofs                                 │    │
│  │  • Merkle Tree                                         │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Application Layer

#### Web Dashboard (`Web/`)
- **Technology**: Next.js 14, React, TypeScript, Tailwind CSS
- **Purpose**: Real-time monitoring and management interface
- **Features**:
  - System overview and statistics
  - Guardian node status with ENS names
  - Live activity feed
  - Audit trail with 0G verification
  - Policy editor

#### CLI Tool (`guardmesh-cli/`)
- **Technology**: Node.js, TypeScript, Commander.js
- **Purpose**: Developer tooling for building governed agents
- **Commands**:
  - `init` - Project initialization
  - `agent` - Agent management
  - `test` - Testing framework
  - `deploy` - Deployment
  - `audit` - Audit queries
  - `guardians` - Guardian management
  - `config` - Configuration

#### SDK/API
- **Technology**: TypeScript, Ethers.js, Axios
- **Purpose**: Programmatic access to GuardMesh
- **Features**:
  - Agent registration
  - Intent submission
  - Policy queries
  - Audit verification

### 2. Guardian Mesh (`axl/`)

#### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Guardian Node                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   HTTP API   │  │   A2A Proto  │  │  MCP Proto  │ │
│  │   (REST)     │  │   (Agent)    │  │   (Tools)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                  │                  │         │
│         └──────────────────┴──────────────────┘         │
│                            │                            │
│  ┌─────────────────────────▼──────────────────────┐   │
│  │         TCP Multiplexer                        │   │
│  │  • Connection Management                       │   │
│  │  • Protocol Routing                            │   │
│  │  • TLS Security                                │   │
│  └─────────────────────────┬──────────────────────┘   │
│                            │                            │
│  ┌─────────────────────────▼──────────────────────┐   │
│  │         P2P Mesh Network                       │   │
│  │  • Peer Discovery                              │   │
│  │  • Message Routing                             │   │
│  │  • Topology Management                         │   │
│  └────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

#### Components

**HTTP API** (`api/handler.go`)
- REST endpoints for external access
- Intent submission
- Status queries
- Topology information

**A2A Protocol** (`api/a2a.go`)
- Agent-to-Agent communication
- Intent propagation
- Verdict collection
- Consensus coordination

**MCP Protocol** (`api/mcp.go`)
- Model Context Protocol integration
- Tool routing
- Resource management

**TCP Layer** (`internal/tcp/`)
- TLS-secured connections
- Connection multiplexing
- Stream management

**Mesh Network**
- Ed25519 identity
- Peer discovery
- Message routing
- Topology management

### 3. Smart Contracts (`0g-contracts/`)

#### GuardMeshRegistry.sol

```solidity
contract GuardMeshRegistry {
    struct AgentPolicy {
        string agentId;
        string roleScope;
        bool active;
        string consensusType;
        string[] allowedActions;
        string[] deniedActions;
        string[] dataSources;
    }
    
    mapping(string => AgentPolicy) public agents;
    
    function registerAgent(...) external;
    function updatePolicy(...) external;
    function getAgent(string agentId) external view returns (AgentPolicy);
}
```

**Purpose**: Agent policy management
**Features**:
- Agent registration
- Policy updates
- Permission queries
- Role management

#### GuardMeshAudit.sol

```solidity
contract GuardMeshAudit {
    struct Decision {
        string agentId;
        string merkleRoot;
        bool approved;
        uint8 outcome;
        string actionType;
        string target;
        uint256 approveCount;
        uint256 blockCount;
        string blockedReason;
        uint256 intentTimestamp;
        uint256 recordedAt;
        address recorder;
    }
    
    mapping(string => Decision) public decisions;
    
    function recordDecision(...) external;
    function getDecision(string merkleRoot) external view returns (Decision);
    function getAllDecisionsPaginated(...) external view returns (Decision[], uint256);
}
```

**Purpose**: Immutable decision recording
**Features**:
- Decision storage
- Merkle root tracking
- History queries
- Pagination support

#### GuardMeshRegistry-ENS.sol

```solidity
contract GuardMeshRegistryENS {
    IENS public ens;
    
    function resolveGuardian(string ensName) external view returns (address);
    function registerGuardianENS(string ensName, address guardian) external;
}
```

**Purpose**: ENS integration for guardian identities
**Features**:
- Guardian name resolution
- Human-readable identifiers
- ENS domain management

### 4. 0G Integration

#### 0G Storage

**Bundle Structure**:
```json
{
  "intent": {
    "agentId": "agent-01",
    "actionType": "read_file",
    "target": "auth.py",
    "payload": {},
    "timestamp": 1234567890
  },
  "verdicts": [
    {
      "guardian": "guardian-1.guardmesh.eth",
      "publicKey": "0x...",
      "verdict": "approve",
      "reason": "Policy allows read_file",
      "teeProof": "0x...",
      "signature": "0x..."
    }
  ],
  "consensus": {
    "approveCount": 3,
    "blockCount": 0,
    "outcome": "approved"
  },
  "merkleRoot": "0xabc...",
  "proof": "0x..."
}
```

**Storage Flow**:
1. Guardian consensus reached
2. Bundle created with all verdicts
3. Merkle tree computed
4. Bundle uploaded to 0G Storage
5. Merkle root recorded on-chain

**Verification**:
```typescript
// Retrieve bundle from 0G Storage
const bundle = await retrieveBundle(merkleRoot);

// Verify merkle root
const computedRoot = computeMerkleRoot(bundle);
assert(computedRoot === merkleRoot);

// Verify guardian signatures
for (const verdict of bundle.verdicts) {
  assert(verifySignature(verdict));
}

// Verify TEE proofs
for (const verdict of bundle.verdicts) {
  assert(verifyTEEProof(verdict.teeProof));
}
```

#### 0G Compute

**TEE Inference Flow**:
```
1. Guardian receives intent
2. Load agent policy from contract
3. Submit to 0G Compute TEE:
   - Model: qwen-2.5-7b-instruct
   - Prompt: Policy evaluation
   - Sealed: true
4. Receive TEE-verified verdict
5. Sign verdict with guardian key
6. Return to mesh
```

**Prompt Template**:
```
You are a guardian node evaluating an AI agent's action request.

Agent ID: {agentId}
Role: {roleScope}
Action: {actionType}
Target: {target}

Policy:
- Allowed Actions: {allowedActions}
- Denied Actions: {deniedActions}
- Data Sources: {dataSources}

Intent Payload:
{payload}

Evaluate whether this action should be APPROVED or BLOCKED.
Provide reasoning for your decision.

Response format:
{
  "verdict": "approve" | "block",
  "reason": "explanation",
  "confidence": 0.0-1.0
}
```

## Data Flow

### Intent Submission Flow

```
1. Agent creates intent
   ↓
2. Submit to guardian mesh (A2A)
   ↓
3. Guardians receive intent
   ↓
4. Each guardian:
   a. Load policy from Registry contract
   b. Submit to 0G Compute TEE
   c. Receive TEE-verified verdict
   d. Sign verdict
   e. Broadcast to mesh
   ↓
5. Consensus coordinator:
   a. Collect all verdicts
   b. Compute consensus
   c. Create bundle
   d. Upload to 0G Storage
   e. Record decision on Audit contract
   ↓
6. Agent receives result
```

### Audit Verification Flow

```
1. Query decision from Audit contract
   ↓
2. Get merkle root
   ↓
3. Retrieve bundle from 0G Storage
   ↓
4. Verify:
   a. Merkle root matches
   b. Guardian signatures valid
   c. TEE proofs valid
   d. Consensus correct
   ↓
5. Return verification result
```

## Security Model

### Threat Model

**Threats**:
- Malicious agent bypassing policy
- Compromised guardian node
- Network attacks (DDoS, MitM)
- Smart contract vulnerabilities
- Storage tampering

**Mitigations**:
- **Policy Enforcement**: On-chain policies, cannot be bypassed
- **TEE Verification**: Guardians run in trusted environments
- **Consensus**: Multiple guardians must agree
- **Cryptographic Proofs**: All decisions signed and verifiable
- **Immutable Storage**: 0G Storage prevents tampering
- **TLS Security**: Encrypted mesh communication
- **Smart Contract Audits**: Formal verification

### Trust Assumptions

1. **Majority of guardians are honest**
2. **0G Compute TEE is secure**
3. **0G Storage is immutable**
4. **Smart contracts are correct**
5. **Cryptographic primitives are secure**

## Performance Characteristics

### Latency

- **Intent submission**: ~100ms (network)
- **Guardian evaluation**: ~500ms (TEE inference)
- **Consensus**: ~200ms (mesh communication)
- **On-chain recording**: ~2s (block time)
- **0G Storage**: ~1s (upload)
- **Total**: ~4s end-to-end

### Throughput

- **Guardians**: 100 intents/sec per node
- **Mesh**: 1000 messages/sec
- **Contracts**: Limited by block gas
- **0G Storage**: High throughput

### Scalability

- **Horizontal**: Add more guardian nodes
- **Sharding**: Partition agents across guardian sets
- **Caching**: Cache policies locally
- **Batching**: Batch decisions on-chain

## Deployment

### Local Development

```bash
# Start guardian nodes
cd axl
./start-guardian-1.ps1
./start-guardian-2.ps1
./start-guardian-3.ps1

# Deploy contracts
cd 0g-contracts
npx hardhat run scripts/deploy.js --network localhost

# Start dashboard
cd Web
npm run dev
```

### Production

```bash
# Deploy to 0G testnet
cd 0g-contracts
npx hardhat run scripts/deploy.js --network 0g-testnet

# Configure guardians
# Update node-config.json with production settings

# Deploy dashboard
cd Web
npm run build
npm start
```

## Monitoring

### Metrics

- Guardian uptime
- Intent throughput
- Consensus latency
- Decision outcomes
- Storage usage
- Gas consumption

### Logging

- Guardian verdicts
- Consensus results
- Contract events
- Storage operations
- Error tracking

### Alerting

- Guardian offline
- Consensus failure
- Contract errors
- Storage issues
- Anomaly detection

## Future Enhancements

1. **Multi-chain support**: Deploy on multiple chains
2. **Advanced policies**: Complex policy DSL
3. **Guardian reputation**: Track guardian performance
4. **Dynamic consensus**: Adjust based on risk
5. **Privacy**: Zero-knowledge proofs for sensitive data
6. **Scalability**: Sharding and layer 2
7. **Interoperability**: Cross-chain governance

---

**GuardMesh: Decentralized Governance for AI Agents**
