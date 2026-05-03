# GuardMesh Agent Framework Guide

## Overview

GuardMesh is a **governance framework for AI agents** built on the 0G network. It provides decentralized policy enforcement, TEE-verified decisions, and immutable audit trails.

## Why GuardMesh?

Traditional AI agents operate without oversight. GuardMesh solves this by:

1. **Decentralized Governance**: Multiple guardian nodes vote on agent actions
2. **TEE Verification**: Decisions verified in Trusted Execution Environments (0G Compute)
3. **Immutable Audit**: All decisions stored permanently on 0G Storage
4. **Policy Enforcement**: On-chain policies that agents cannot bypass

## Architecture

### Components

```
┌──────────────────────────────────────────────────────────┐
│                    Your AI Agent                         │
│  (Built with GuardMesh SDK or CLI)                      │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ 1. Submit Intent
                     ▼
┌──────────────────────────────────────────────────────────┐
│              AXL Guardian Mesh (P2P)                     │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │Guardian 1│◄──►│Guardian 2│◄──►│Guardian 3│         │
│  │ (TEE)    │    │ (TEE)    │    │ (TEE)    │         │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘         │
│       │               │               │                 │
│       └───────────────┴───────────────┘                 │
│                       │                                  │
│              2. Consensus Voting                         │
└───────────────────────┬──────────────────────────────────┘
                        │
                        │ 3. Record Decision
                        ▼
┌──────────────────────────────────────────────────────────┐
│           GuardMesh Smart Contracts (0G EVM)             │
│                                                          │
│  ┌─────────────────────┐  ┌──────────────────────┐     │
│  │  Registry Contract  │  │   Audit Contract     │     │
│  │  • Agent Policies   │  │   • Decisions        │     │
│  │  • Permissions      │  │   • Merkle Roots     │     │
│  └─────────────────────┘  └──────────────────────┘     │
└───────────────────────┬──────────────────────────────────┘
                        │
                        │ 4. Store Bundle
                        ▼
┌──────────────────────────────────────────────────────────┐
│                  0G Storage Network                      │
│                                                          │
│  • Intent Payload                                        │
│  • Guardian Verdicts                                     │
│  • Verification Proofs                                   │
│  • Cryptographic Evidence                                │
└──────────────────────────────────────────────────────────┘
```

### Flow

1. **Agent submits intent** → Guardian mesh via AXL
2. **Guardians evaluate** → TEE-verified inference (0G Compute)
3. **Consensus reached** → Decision recorded on-chain
4. **Bundle stored** → Full audit trail on 0G Storage

## Core Concepts

### 1. Agents

Agents are AI systems with defined roles and permissions.

```yaml
agentId: code-analyzer-01
roleScope: code_analysis_only
allowedActions:
  - read_file
  - code_analysis
deniedActions:
  - write_file
  - change_permissions
```

### 2. Guardians

Guardian nodes are TEE-verified validators that:
- Evaluate agent intents against policies
- Vote on whether to approve/block actions
- Run in Trusted Execution Environments (0G Compute)

### 3. Policies

On-chain rules that define what agents can/cannot do:

```typescript
{
  agentId: "my-agent",
  roleScope: "analytics_readonly",
  allowedActions: ["query_db", "read_file"],
  deniedActions: ["change_permissions", "export_pii"],
  consensusType: "majority" // unanimous, majority, any
}
```

### 4. Intents

Actions that agents want to perform:

```typescript
{
  agentId: "my-agent",
  actionType: "query_db",
  target: "user_metrics",
  payload: { query: "SELECT COUNT(*) FROM users" },
  timestamp: 1234567890
}
```

### 5. Decisions

Guardian consensus results stored on-chain:

```typescript
{
  agentId: "my-agent",
  merkleRoot: "0xabc...",
  approved: true,
  outcome: 1, // 0=pending, 1=approved, 2=blocked
  approveCount: 3,
  blockCount: 0,
  recordedAt: 1234567890
}
```

## Building Agents

### Method 1: Using the CLI (Recommended)

```bash
# Initialize project
guardmesh init my-agent --template code-analyzer

# Register agent
guardmesh agent register -i my-agent-01 -r code_analysis_only

# Test actions
guardmesh test action -a my-agent-01 --action read_file --target test.txt

# Deploy
guardmesh deploy
```

### Method 2: Using the SDK

```typescript
import { GuardMeshAgent } from '@guardmesh/sdk';

const agent = new GuardMeshAgent({
  agentId: 'my-agent-01',
  guardianEndpoint: 'http://127.0.0.1:9002',
});

// Request approval before action
const approved = await agent.requestAction('read_file', 'config.json');

if (approved) {
  // Perform action
  const data = await fs.readFile('config.json');
} else {
  throw new Error('Action blocked by guardians');
}
```

## Integration with 0G

### 0G Storage

All audit decisions are stored on 0G Storage:

```typescript
// Bundle structure stored on 0G
{
  intent: {
    agentId: "my-agent",
    actionType: "read_file",
    target: "auth.py",
    timestamp: 1234567890
  },
  verdicts: [
    { guardian: "guardian-1.guardmesh.eth", verdict: "approve", reason: "..." },
    { guardian: "guardian-2.guardmesh.eth", verdict: "approve", reason: "..." },
    { guardian: "guardian-3.guardmesh.eth", verdict: "approve", reason: "..." }
  ],
  proof: "0x...",
  merkleRoot: "0xabc..."
}
```

### 0G Compute

Guardians run TEE-verified inference:

```typescript
// Guardian evaluation in TEE
const verdict = await teeInference({
  model: "qwen-2.5-7b-instruct",
  prompt: `Evaluate this agent intent:
    Agent: ${intent.agentId}
    Action: ${intent.actionType}
    Target: ${intent.target}
    Policy: ${policy}
    
    Should this be approved?`,
  sealed: true // TEE verification
});
```

## Use Cases

### 1. Code Review Agent

```bash
guardmesh init code-reviewer --template code-analyzer
```

**Permissions**: Read code, analyze, suggest improvements  
**Restrictions**: Cannot modify code, cannot access production

### 2. Data Analytics Agent

```bash
guardmesh init analytics-bot --template data-bot
```

**Permissions**: Query databases, read metrics  
**Restrictions**: Cannot export PII, cannot modify data

### 3. Customer Support Agent

```yaml
agentId: support-bot-01
roleScope: customer_support
allowedActions:
  - read_ticket
  - send_message
  - query_knowledge_base
deniedActions:
  - refund_payment
  - access_admin_panel
  - export_user_data
```

### 4. DevOps Agent

```yaml
agentId: devops-bot-01
roleScope: deployment_automation
allowedActions:
  - deploy_staging
  - run_tests
  - read_logs
deniedActions:
  - deploy_production  # Requires human approval
  - delete_database
  - modify_firewall
```

## Testing

### Unit Testing

```typescript
import { GuardMeshAgent } from '@guardmesh/sdk';

describe('Agent Actions', () => {
  it('should get approval for allowed action', async () => {
    const agent = new GuardMeshAgent({ agentId: 'test-agent' });
    const approved = await agent.requestAction('read_file', 'test.txt');
    expect(approved).toBe(true);
  });

  it('should be blocked for denied action', async () => {
    const agent = new GuardMeshAgent({ agentId: 'test-agent' });
    const approved = await agent.requestAction('delete_database', 'prod');
    expect(approved).toBe(false);
  });
});
```

### Integration Testing

```bash
# Test against live guardian mesh
guardmesh test action -a my-agent --action read_file --target test.txt

# Test policy configuration
guardmesh test policy -a my-agent
```

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
npm run deploy

# Configure CLI
guardmesh config --rpc http://localhost:8545
guardmesh config --registry 0x...
guardmesh config --audit 0x...
```

### Production

```bash
# Use 0G testnet
guardmesh config --rpc https://evmrpc-testnet.0g.ai

# Deploy with production config
guardmesh deploy --config agent.production.yaml
```

## Monitoring

### Watch Audit Feed

```bash
guardmesh audit watch -a my-agent
```

### Query History

```bash
guardmesh audit history -a my-agent -l 50
```

### Verify Decisions

```bash
guardmesh audit verify 0xabc123...
```

### Guardian Status

```bash
guardmesh guardians status
```

## Best Practices

1. **Start with restrictive policies** - Add permissions as needed
2. **Use unanimous consensus for critical actions** - Majority for routine tasks
3. **Test thoroughly before production** - Use `guardmesh test` extensively
4. **Monitor audit trails** - Watch for unexpected patterns
5. **Version your policies** - Track changes over time
6. **Document agent capabilities** - Clear README for each agent

## Security Considerations

- **TEE Verification**: Guardians run in trusted environments
- **Immutable Audit**: Cannot delete or modify past decisions
- **Decentralized**: No single point of failure
- **On-Chain Policies**: Cannot be bypassed by agents
- **Cryptographic Proofs**: All decisions verifiable

## Roadmap

- [ ] Multi-chain support
- [ ] Advanced policy DSL
- [ ] Guardian reputation system
- [ ] Agent marketplace
- [ ] Visual policy editor
- [ ] Real-time dashboard
- [ ] Mobile monitoring app

## Contributing

We welcome contributions! Areas of focus:

- New agent templates
- Guardian node improvements
- CLI enhancements
- Documentation
- Testing frameworks

## Support

- **Discord**: [Join our community](https://discord.gg/guardmesh)
- **GitHub**: [Report issues](https://github.com/yourusername/guardmesh/issues)
- **Docs**: [Full documentation](https://docs.guardmesh.io)

---

**Built for the 0G Hackathon - Best Agent Framework Track**
