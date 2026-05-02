# ENS Integration Guide for GenGuard

## Overview

GenGuard integrates ENS (Ethereum Name Service) to give AI guardian agents persistent, human-readable identities. Instead of using raw addresses like `0xAbcd...5678`, guardians are discoverable as:

```
guardian-1.guardmesh.eth
guardian-2.guardmesh.eth
guardian-3.guardmesh.eth
```

## Architecture

```
Ethereum L1 (ENS Registry)
    ↓
    guardmesh.eth (parent domain)
    ├─ guardian-1.guardmesh.eth → resolves to 0x... (0G Chain address)
    ├─ guardian-2.guardmesh.eth → resolves to 0x... (0G Chain address)
    └─ guardian-3.guardmesh.eth → resolves to 0x... (0G Chain address)

0G Chain (GuardMeshRegistry)
    ↓
    Each guardian agent has:
    - On-chain policy (allowed/denied actions)
    - ENS identity (discoverable name)
    - Metadata in ENS text records
    - Verifiable reputation
```

## Setup Steps

### 1. Register Parent Domain `guardmesh.eth`

The parent domain must be registered first. This is a one-time setup:

```bash
# Go to https://app.ens.domains/
# Search for "guardmesh"
# Register for 1+ year
# Cost: ~5 USD/year (plus registration fee)
```

### 2. Bootstrap Each Guardian

Run the bootstrap script for each guardian:

```bash
# Set environment variables
export GUARDIAN_ID="guardian-1"
export PRIVATE_KEY="your_0g_wallet_private_key"
export RPC_URL="https://evmrpc-testnet.0g.ai"

# Run bootstrap
npm run guardian:bootstrap
```

This will:
- ✅ Create ENS identity config
- ✅ Validate ENS resolution (if already registered)
- ✅ Store metadata for runtime access

### 3. Register Guardian Subnames

Each guardian subname must be registered on ENS:

```bash
# Via ENS Manager App:
# 1. Go to https://app.ens.domains/guardmesh.eth
# 2. Click "Create Subname"
# 3. Name: "guardian-1"
# 4. Owner: Your 0G wallet address
# 5. Set resolver to Public Resolver
# 6. Confirm transaction

# Or programmatically (requires wrapper):
npm run guardian:register-ens guardian-1
```

### 4. Set Guardian Metadata

After registering the subname, add metadata:

```bash
# Via script
npm run guardian:update-metadata guardian-1

# This sets text records in ENS:
# - guardian.role: "code_analysis_only"
# - guardian.version: "1.0.0"
# - guardian.capabilities: ["role_check", "permission_check", "content_check"]
# - guardian.model: "qwen-2.5-7b-instruct"
# - guardian.status: "active"
```

## Usage

### Resolve Guardian Address

```javascript
import { resolveGuardianAddress } from './ens-utils.mjs';

// Resolve guardian-1.guardmesh.eth → 0x address
const address = await resolveGuardianAddress('guardian-1');
// → "0x225f137127d9067788314bc7fcc1f36746a3c3B5"
```

### Get Guardian Metadata

```javascript
import { getGuardianMetadata } from './ens-utils.mjs';

const metadata = await getGuardianMetadata('guardian-1.guardmesh.eth');
// → {
//     "guardian.role": "code_analysis_only",
//     "guardian.version": "1.0.0",
//     "guardian.capabilities": "[\"role_check\", \"permission_check\"]",
//     ...
//   }
```

### Update Metadata

```javascript
import { setGuardianMetadata } from './ens-utils.mjs';

// Update metadata (requires signer with ownership)
await setGuardianMetadata(signer, 'guardian-1.guardmesh.eth', {
  'guardian.version': '1.1.0',
  'guardian.capabilities': JSON.stringify(['enhanced_analysis']),
});
```

## Frontend Integration

The frontend displays guardians with ENS names:

```tsx
import { GuardianENSCard, GuardiansList } from '@/components/GuardianENSCard';

export function GuardiansView() {
  const guardians = [
    {
      id: 'guardian-1',
      address: '0x225f...3B5',
      ensName: 'guardian-1.guardmesh.eth',
      role: 'code_analysis_only',
      status: 'active',
      model: 'qwen-2.5-7b-instruct',
      version: '1.0.0',
    },
    // ...
  ];

  return <GuardiansList guardians={guardians} />;
}
```

Features:
- 🔗 Displays ENS names instead of raw addresses
- ✓ Verifies address matches ENS resolution
- 📝 Shows metadata from ENS text records
- 🔍 Links to ENS App for details

## Smart Contract Integration

Update the Guardian smart contract to verify ENS:

```solidity
// GuardMeshRegistry-ENS.sol
contract GuardMeshRegistryENS is GuardMeshRegistry {
    
    // Register agent with ENS identity
    function registerAgentWithENS(
        string memory agentId,
        string memory ensName,
        address ensResolver,
        string memory roleScope,
        // ... policy params
    ) external returns (bytes32) {
        // 1. Register on-chain policy
        // 2. Link to ENS name
        // 3. Emit event
    }
    
    // Verify agent via ENS
    function verifyAgentViaENS(
        string memory agentId,
        address expectedAddress
    ) external view returns (bool) {
        // Check if ENS name resolves to expected address
    }
}
```

## Creative Use Cases

### 1. Agent Reputation via ENS

Store agent reputation in text records:

```
guardian-1.guardmesh.eth
├─ guardian.reputation: "0x..." (ZK proof)
├─ guardian.audit_status: "verified"
└─ guardian.verdicts_issued: "1,247"
```

### 2. Subnames as Access Tokens

Create access tokens as ENS subnames:

```
access.guardian-1.guardmesh.eth    → Tier 1 access
premium.guardian-1.guardmesh.eth   → Premium access
verifier.guardian-1.guardmesh.eth  → Verification rights
```

### 3. Cross-Chain Agent Discovery

Link agent addresses across chains:

```
// guardian-1.guardmesh.eth text records:
- addr.60: 0x... (Ethereum)
- addr.2147525809: 0x... (Arbitrum)
- addr.2147492101: 0x... (Base)
```

## Testing

```bash
# Test ENS resolution
npm run test:ens-resolution

# Test metadata retrieval
npm run test:ens-metadata

# Test contract integration
npm run test:guardmesh-ens
```

## Addresses & Configuration

### Mainnet

```javascript
ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
PUBLIC_RESOLVER = "0x231b0Ee14048e9dCcD1d247744d114D4c7FC10F2"
```

### Testnet (Sepolia)

```javascript
ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
PUBLIC_RESOLVER = "0xd7a28e5e91ca4bfac59fb983e674289febde473fb"
```

## Limitations & Notes

1. **ENS Resolution Starts on L1**: All resolution begins on Ethereum Mainnet. 0G Chain addresses are stored in text records.

2. **Gas Costs**: Registering and updating ENS names costs gas on Ethereum. Consider batching updates.

3. **TTL Caching**: ENS names cache for ~1 hour. Updates may not be immediate.

4. **Custom Resolvers**: For advanced use cases, deploy custom resolvers on 0G Chain using CCIP Read.

## Resources

- [ENS Docs](https://docs.ens.domains/)
- [ENS Manager](https://app.ens.domains/)
- [ENSIP-5 Text Records](https://docs.ens.domains/ensip/5)
- [ENSIP-9 Multichain](https://docs.ens.domains/ensip/9)
- [ENS Names on L2](https://docs.ens.domains/ensip/11)

## Troubleshooting

### Guardian ENS name not resolving

```javascript
// Check if registered
const ensName = await resolveGuardianAddress('guardian-1');
// If error: Name not registered or resolver not set

// Steps:
// 1. Verify subname exists at app.ens.domains/guardmesh.eth
// 2. Check resolver is set (should be Public Resolver)
// 3. Wait 5 minutes for DNS propagation
```

### Metadata not updating

```javascript
// Verify you're the owner
const owner = await ens.owner(namehash('guardian-1.guardmesh.eth'));
// Should equal your address

// If not owner:
// - Register with correct address
// - Or update ENS ownership
```

## Support

For issues or questions:
- File an issue on GitHub
- Join ENS Developer Discord: https://discord.gg/ensdomains
- Check ENS Docs: https://docs.ens.domains/

---

**Next**: [Deploy GuardMesh on 0G Chain](./START_GUARDMESH.md)
