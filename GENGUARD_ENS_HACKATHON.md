# ENS Integration for GenGuard - Hackathon Submission

## Overview

GenGuard now integrates **ENS (Ethereum Name Service)** to give AI guardian agents first-class on-chain identities. This solves a critical problem: **AI agents need persistent, discoverable names just like humans do.**

Instead of raw addresses like `0x225f137...3B5`, guardians are now discoverable as:

```
🔗 guardian-1.guardmesh.eth
🔗 guardian-2.guardmesh.eth  
🔗 guardian-3.guardmesh.eth
```

## Why ENS for AI Agents?

1. **Persistent Identity**: Each guardian has a human-readable name that doesn't change
2. **Discoverability**: Other agents and applications can find guardians by name
3. **Reputation Building**: Agent reputation and metadata stored on-chain
4. **Trust**: ENS names are verifiable and cryptographically secured
5. **Interoperability**: Works across chains and applications

## Integration Points

### 1. Guardian Agent Identity (`ens-utils.mjs`)
- Resolve guardian addresses from ENS names
- Fetch guardian metadata from text records
- Register new guardians with ENS
- Update metadata at runtime

### 2. Smart Contract Integration (`GuardMeshRegistry-ENS.sol`)
- Store agent → ENS name mappings
- Verify agents via ENS resolution
- Query metadata directly from on-chain ENS
- Emit events when ENS identity changes

### 3. Frontend Display (`GuardianENSCard.tsx`)
- Display guardians with ENS names instead of addresses
- Show metadata from ENS text records
- Verify address matches ENS resolution
- Link to ENS App for details

### 4. Guardian Bootstrap (`guardian-ens-boot.mjs`)
- Initialize ENS on startup
- Create ENS identity for each guardian
- Store metadata configuration
- Print setup instructions

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Ethereum L1 (ENS Registry - Source of Truth)    │
│                                                          │
│  guardmesh.eth (parent domain)                           │
│  ├─ guardian-1.guardmesh.eth                            │
│  │   ├─ Resolver: Public Resolver (0x231b0Ee1...)      │
│  │   └─ Records:                                         │
│  │       ├─ addr (ETH): 0x225f137...3B5                │
│  │       ├─ guardian.role: "code_analysis_only"         │
│  │       ├─ guardian.version: "1.0.0"                   │
│  │       └─ guardian.capabilities: [...]               │
│  │                                                       │
│  └─ guardian-2.guardmesh.eth                            │
│      ├─ Resolver: Public Resolver                       │
│      └─ Records: ...                                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
         ↑                ↑               ↑
         │                │               │
    Resolution        Resolution     Metadata
    (address)         (address)      (text records)
         │                │               │
    ┌────┴────┬───────────┴───┬──────────┴────┐
    │          │               │               │
┌───▼──┐  ┌───▼──┐        ┌──▼────┐      ┌──▼────┐
│ Node │  │ Node │        │ React │      │ Smart │
│ A    │  │ B    │        │ Front │      │Contract│
│(AXL) │  │(AXL) │        │ End   │      │ (0G)  │
└──────┘  └──────┘        └───────┘      └───────┘

0G Chain (Policy Enforcement)
```

## Hackathon Value Proposition

### 🤖 Best ENS Integration for AI Agents

**How GenGuard wins:**

1. **Real Utility**: ENS names replace raw addresses - obvious improvement
2. **Agent Discovery**: Other systems can find guardians via ENS
3. **Metadata on-chain**: Capabilities, role, version all verifiable
4. **Cross-agent Coordination**: Guardians can reference each other by name
5. **Functional Demo**: Not hard-coded, works with live ENS resolution

### ✨ Most Creative Use of ENS

**Advanced features:**

1. **ENS Text Records for Agent Metadata**
   - Store capabilities, role, model info in text records
   - Metadata is immutable while resolver is locked
   - Enables verifiable agent profiles

2. **Subname-based Access Tokens**
   ```
   access.guardian-1.guardmesh.eth      → Tier 1 access
   premium.guardian-1.guardmesh.eth     → Premium access
   verifier.guardian-1.guardmesh.eth    → Verification authority
   ```
   Different subnames = different permission levels, managed via ENS

3. **Guardian Reputation via ENS**
   ```
   guardian-1.guardmesh.eth text records:
   - reputation_score: "0x..." (ZK proof)
   - audited: "true"
   - verdicts_issued: "1,247"
   - slash_events: "0"
   ```

4. **Multi-chain Agent Discovery**
   ```
   // Using ENSIP-11 multichain addresses
   guardian-1.guardmesh.eth resolves to:
   - Ethereum: 0x... (registered address)
   - Arbitrum: 0x... (via cointype)
   - Base: 0x... (via cointype)
   - 0G Chain: 0x... (via cointype)
   ```

## Setup Instructions

### 1. Install Dependencies

```bash
cd guardmesh-guardian
npm install
# Adds: viem, wagmi, ethers
```

### 2. Register Parent Domain

```bash
# Go to https://app.ens.domains/
# Search for "guardmesh"
# Register guardmesh.eth for 1+ year
```

### 3. Bootstrap Guardian

```bash
export GUARDIAN_ID="guardian-1"
export PRIVATE_KEY="0x..."
export RPC_URL="https://evmrpc-testnet.0g.ai"

npm run guardian:bootstrap
```

### 4. Register Subname on ENS

```bash
# Via ENS Manager:
# 1. https://app.ens.domains/guardmesh.eth
# 2. Create Subname: guardian-1
# 3. Owner: your wallet
# 4. Set resolver: Public Resolver
# 5. Confirm
```

### 5. Update Metadata

```bash
npm run guardian:update-metadata guardian-1
```

### 6. Verify Integration

```bash
npm run test:ens-integration
```

## Code Examples

### Resolve Guardian

```javascript
import { resolveGuardianAddress } from './ens-utils.mjs';

const address = await resolveGuardianAddress('guardian-1');
// → "0x225f137127d9067788314bc7fcc1f36746a3c3B5"
```

### Get Metadata

```javascript
import { getGuardianMetadata } from './ens-utils.mjs';

const metadata = await getGuardianMetadata('guardian-1.guardmesh.eth');
// → {
//     "guardian.role": "code_analysis_only",
//     "guardian.version": "1.0.0",
//     "guardian.capabilities": "[...]",
//   }
```

### Display in Frontend

```tsx
<GuardianENSCard guardian={{
  id: 'guardian-1',
  address: '0x225f...',
  ensName: 'guardian-1.guardmesh.eth',
  role: 'code_analysis_only',
  status: 'active',
}} />
```

### Smart Contract Verification

```solidity
function verifyGuardianViaENS(
    string memory agentId,
    address expectedAddress
) external view returns (bool) {
    return GuardMeshRegistry.verifyAgentViaENS(
        agentId,
        expectedAddress
    );
}
```

## Files Created

1. **[ens-utils.mjs](guardmesh-guardian/ens-utils.mjs)** - ENS resolution utilities
2. **[GuardMeshRegistry-ENS.sol](0g-contracts/contracts/GuardMeshRegistry-ENS.sol)** - Smart contract ENS integration
3. **[GuardianENSCard.tsx](Web/components/GuardianENSCard.tsx)** - React component
4. **[guardian-ens-boot.mjs](guardmesh-guardian/guardian-ens-boot.mjs)** - Bootstrap script
5. **[example-ens-complete.mjs](guardmesh-guardian/example-ens-complete.mjs)** - Complete example
6. **[ENS_INTEGRATION_GUIDE.md](ENS_INTEGRATION_GUIDE.md)** - Full documentation

## How It Solves AI Agent Identity

| Problem | Solution |
|---------|----------|
| Raw addresses are unmemorable | ENS names are human-readable |
| No way to discover agents | ENS enables naming + lookup |
| Agent metadata scattered | Text records centralize metadata |
| No reputation tracking | Can store reputation in ENS |
| Single-chain only | ENSIP-11 enables multichain |
| Hard to verify authenticity | ENS is cryptographically verified |

## Verification & Testing

### Local Testing

```bash
# Test ENS resolution
npm run test:ens-resolve

# Test metadata queries
npm run test:ens-metadata

# Test smart contract
npm run test:guardmesh-ens
```

### Testnet Testing

```bash
# Deploy contracts to 0G testnet
npm run deploy:0g

# Register on Sepolia ENS
npm run register:ens-testnet

# Full integration test
npm run test:integration
```

## Demo Flow

1. **Show Guardian ENS Names**: Display `guardian-1.guardmesh.eth` on frontend
2. **Verify Resolution**: Resolve ENS name → 0G address
3. **Show Metadata**: Display guardian capabilities from ENS text records
4. **Demo Agent Discovery**: "Any system can find guardians by name"
5. **Show Contract Integration**: Query ENS from smart contract
6. **Creative Use**: Show subname access tokens or reputation tracking

## Key Advantages

✅ **Real-world applicable** - AI agents need discoverable identities  
✅ **On-chain verified** - ENS provides cryptographic proof  
✅ **Decentralized** - No centralized registry needed  
✅ **Composable** - Works with other ENS-enabled apps  
✅ **Scalable** - Supports unlimited agents via subnames  
✅ **User-friendly** - Humans can remember names  

## Resources

- [ENS Docs](https://docs.ens.domains/)
- [ENS Manager App](https://app.ens.domains/)
- [Building with AI](https://docs.ens.domains/building-with-ai/)
- [ENS on GitHub](https://github.com/ensdomains)

## Video Demo Script

```
[0s] "AI agents need identity just like humans do"
[5s] "Introducing GenGuard with ENS integration"
[10s] Show guardian-1.guardmesh.eth in UI
[15s] Resolve ENS name → 0G address
[20s] Display guardian metadata from text records
[25s] Show smart contract ENS verification
[30s] "Agents are now discoverable, verifiable, and have reputation"
[35s] "This is the future of AI agents on-chain"
```

---

**Status**: ✅ Implemented  
**Ready for**: Hackathon submission  
**Integration**: 0G Chain + Ethereum ENS  
**Prize Category**: "Best ENS Integration for AI Agents" + "Most Creative Use of ENS"
