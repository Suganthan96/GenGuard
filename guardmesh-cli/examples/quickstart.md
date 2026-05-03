# GuardMesh CLI Quick Start

Get started with GuardMesh in 5 minutes.

## Prerequisites

- Node.js 18+
- npm or yarn
- 0G testnet access
- Guardian nodes running (or use public endpoints)

## Step 1: Install CLI

```bash
npm install -g @guardmesh/cli
```

Verify installation:

```bash
guardmesh --version
```

## Step 2: Initialize Your First Agent

```bash
guardmesh init my-first-agent --template code-analyzer
cd my-first-agent
npm install
```

This creates:
```
my-first-agent/
├── src/
│   └── index.ts          # Agent implementation
├── policies/
│   └── policy.yaml       # Policy configuration
├── agent.yaml            # Agent metadata
├── package.json
├── .env.example
└── README.md
```

## Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Agent Configuration
AGENT_ID=my-first-agent-01
GUARDIAN_ENDPOINT=http://127.0.0.1:9002

# 0G Testnet
RPC_URL=https://evmrpc-testnet.0g.ai
REGISTRY_ADDRESS=0xYourRegistryAddress
AUDIT_ADDRESS=0xYourAuditAddress

# Your wallet private key (for signing transactions)
PRIVATE_KEY=0xYourPrivateKey
```

## Step 4: Configure CLI

```bash
guardmesh config --rpc https://evmrpc-testnet.0g.ai
guardmesh config --registry 0xYourRegistryAddress
guardmesh config --audit 0xYourAuditAddress
```

View configuration:

```bash
guardmesh config --show
```

## Step 5: Register Your Agent

```bash
guardmesh agent register \
  -i my-first-agent-01 \
  -r code_analysis_only \
  -a "read_file,code_analysis,query_db" \
  -d "write_file,change_permissions,forum_post"
```

Expected output:
```
✓ Agent registered successfully

Agent Details:
  Agent ID: my-first-agent-01
  Role: code_analysis_only
  Allowed: read_file, code_analysis, query_db
  Denied: write_file, change_permissions, forum_post
  Tx Hash: 0xabc123...
```

## Step 6: Test Your Agent

Test a single action:

```bash
guardmesh test action \
  -a my-first-agent-01 \
  --action read_file \
  --target auth.py
```

Expected output:
```
Test Results:
  Agent: my-first-agent-01
  Action: read_file
  Target: auth.py

Guardian Responses:
  Guardian 1: ✓ APPROVE (http://127.0.0.1:9002)
  Guardian 2: ✓ APPROVE (http://127.0.0.1:9012)
  Guardian 3: ✓ APPROVE (http://127.0.0.1:9022)

Consensus:
  Approve: 3
  Block: 0
  Outcome: APPROVED
```

Test policy configuration:

```bash
guardmesh test policy -a my-first-agent-01
```

## Step 7: Deploy Your Agent

```bash
guardmesh deploy --config agent.yaml
```

Expected output:
```
✓ Agent deployed successfully

Deployment Details:
  Transaction: 0xdef456...
  Block: 12345
  Gas Used: 150000

Next Steps:
  • Test your agent: guardmesh test action -a my-first-agent-01 --action read_file --target test.txt
  • Watch audit feed: guardmesh audit watch -a my-first-agent-01
  • View dashboard: http://localhost:3000/home/guardians
```

## Step 8: Monitor Your Agent

Watch live audit feed:

```bash
guardmesh audit watch -a my-first-agent-01
```

Query audit history:

```bash
guardmesh audit history -a my-first-agent-01 -l 20
```

Check guardian status:

```bash
guardmesh guardians status
```

## Step 9: Run Your Agent

```bash
npm run dev
```

Your agent will now:
1. Request approval from guardians before each action
2. Only perform approved actions
3. Have all decisions recorded on-chain
4. Store audit bundles on 0G Storage

## Example Agent Code

The generated `src/index.ts` includes:

```typescript
import axios from 'axios';

class GuardMeshAgent {
  async requestAction(actionType: string, target: string) {
    const intent = {
      agentId: this.agentId,
      actionType,
      target,
      timestamp: Date.now(),
    };

    const response = await axios.post(
      `${this.guardianEndpoint}/a2a/send`,
      { intent }
    );

    return response.data.verdict === 'approve';
  }

  async performAction(actionType: string, target: string) {
    console.log(`Requesting approval for: ${actionType} on ${target}`);
    
    const approved = await this.requestAction(actionType, target);

    if (!approved) {
      throw new Error('Action blocked by guardians');
    }

    console.log('Action approved by guardians');
    
    // Your action logic here
  }
}
```

## Next Steps

### Customize Your Agent

Edit `src/index.ts` to add your agent logic:

```typescript
async function analyzeCode(filePath: string) {
  const agent = new GuardMeshAgent('my-first-agent-01');
  
  // Request approval
  await agent.performAction('code_analysis', filePath);
  
  // Perform analysis
  const code = await fs.readFile(filePath, 'utf8');
  const analysis = await analyzeCodeQuality(code);
  
  return analysis;
}
```

### Add More Permissions

```bash
guardmesh agent register \
  -i my-first-agent-01 \
  -r code_analysis_only \
  -a "read_file,code_analysis,query_db,generate_report"
```

### Create More Agents

```bash
# Data analytics agent
guardmesh init analytics-bot --template data-bot

# Custom agent
guardmesh init custom-agent --template custom
```

### Monitor Production

```bash
# Watch all agents
guardmesh audit watch

# Filter by outcome
guardmesh audit watch -o blocked

# Verify specific decision
guardmesh audit verify 0xabc123...
```

## Troubleshooting

### Guardian Connection Failed

```bash
# Check guardian status
guardmesh guardians status

# Verify endpoint in .env
GUARDIAN_ENDPOINT=http://127.0.0.1:9002
```

### Transaction Failed

```bash
# Check RPC connection
guardmesh config --show

# Verify contract addresses
guardmesh config --registry 0xCorrectAddress
```

### Action Blocked

```bash
# Check agent policy
guardmesh agent info my-first-agent-01

# Test policy
guardmesh test policy -a my-first-agent-01
```

## Resources

- [Full Documentation](../FRAMEWORK_GUIDE.md)
- [API Reference](../docs/API.md)
- [Examples](../examples/)
- [Discord Community](https://discord.gg/guardmesh)

## What's Next?

- Build a production agent
- Set up your own guardian nodes
- Integrate with your existing systems
- Join the GuardMesh community

---

**Congratulations!** 🎉 You've built your first governed AI agent with GuardMesh.
