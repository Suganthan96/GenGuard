# GuardMesh CLI

> CLI framework for building governed AI agents on 0G with GuardMesh

GuardMesh CLI is a developer tool for creating, testing, and deploying AI agents with built-in governance, TEE-verified decisions, and immutable audit trails on the 0G network.

## Features

- 🚀 **Quick Start**: Initialize agent projects with templates
- 🔐 **Policy Management**: Define and enforce agent permissions
- 🧪 **Testing Framework**: Test actions against guardian mesh before deployment
- 📊 **Audit Trail**: Query and verify decisions on 0G Storage
- 🌐 **Guardian Management**: Monitor and manage guardian nodes
- 🛠️ **Developer-Friendly**: Simple CLI commands for complex operations

## Installation

```bash
npm install -g @guardmesh/cli
```

Or use directly with npx:

```bash
npx @guardmesh/cli init my-agent
```

## Quick Start

### 1. Initialize a New Agent

```bash
guardmesh init my-agent --template code-analyzer
cd my-agent
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Configure GuardMesh

```bash
guardmesh config --rpc https://evmrpc-testnet.0g.ai
guardmesh config --registry 0xYourRegistryAddress
guardmesh config --audit 0xYourAuditAddress
```

### 4. Register Your Agent

```bash
guardmesh agent register \
  -i my-agent-01 \
  -r code_analysis_only \
  -a "read_file,code_analysis" \
  -d "write_file,change_permissions"
```

### 5. Test Actions

```bash
guardmesh test action \
  -a my-agent-01 \
  --action read_file \
  --target auth.py
```

### 6. Deploy

```bash
guardmesh deploy --config agent.yaml
```

## Commands

### `guardmesh init`

Initialize a new agent project with templates.

```bash
guardmesh init [name] [options]

Options:
  -t, --template <type>  Agent template (code-analyzer, data-bot, custom)
  -d, --dir <path>       Target directory
```

### `guardmesh agent`

Manage agents and policies.

```bash
# Register a new agent
guardmesh agent register -i <agentId> -r <role> [-a <allowed>] [-d <denied>]

# List all agents
guardmesh agent list

# Get agent details
guardmesh agent info <agentId>
```

### `guardmesh test`

Test agent actions against guardians.

```bash
# Test a single action
guardmesh test action -a <agentId> --action <type> --target <resource>

# Test policy configuration
guardmesh test policy -a <agentId>
```

### `guardmesh deploy`

Deploy agent with governance.

```bash
guardmesh deploy [options]

Options:
  -c, --config <path>  Agent config file (default: agent.yaml)
  --dry-run            Simulate deployment
```

### `guardmesh audit`

Query audit trail and decisions.

```bash
# Watch live audit feed
guardmesh audit watch [-a <agentId>] [-o <outcome>]

# Query audit history
guardmesh audit history [-a <agentId>] [-l <limit>]

# Verify decision on 0G Storage
guardmesh audit verify <merkleRoot>
```

### `guardmesh guardians`

Manage guardian nodes.

```bash
# Show guardian status
guardmesh guardians status

# Add a guardian
guardmesh guardians add -p <pubkey> -e <ens> [--endpoint <url>]

# Remove a guardian
guardmesh guardians remove <pubkey>
```

### `guardmesh config`

Configure GuardMesh CLI.

```bash
guardmesh config [options]

Options:
  --rpc <url>           Set RPC endpoint
  --registry <address>  Set registry contract address
  --audit <address>     Set audit contract address
  --show                Show current configuration
```

## Agent Templates

### Code Analyzer

An agent restricted to code analysis tasks.

```bash
guardmesh init my-analyzer --template code-analyzer
```

**Allowed**: `read_file`, `code_analysis`, `query_db`  
**Denied**: `write_file`, `change_permissions`, `forum_post`

### Data Bot

An agent for read-only analytics.

```bash
guardmesh init my-databot --template data-bot
```

**Allowed**: `query_db`, `read_file`  
**Denied**: `change_permissions`, `export_pii`, `write_file`

### Custom

A blank template for custom agents.

```bash
guardmesh init my-agent --template custom
```

## Architecture

GuardMesh CLI integrates with:

- **GuardMesh Registry**: On-chain agent policy management
- **GuardMesh Audit**: Immutable decision log
- **AXL Mesh**: P2P guardian communication layer
- **0G Storage**: Decentralized audit trail storage
- **0G Compute**: TEE-verified guardian inference

```
┌─────────────┐
│   Your      │
│   Agent     │
└──────┬──────┘
       │ Intent
       ▼
┌─────────────────────────────────┐
│     Guardian Mesh (AXL)         │
│  ┌─────┐  ┌─────┐  ┌─────┐    │
│  │ G1  │  │ G2  │  │ G3  │    │ ◄── TEE Inference (0G Compute)
│  └─────┘  └─────┘  └─────┘    │
└──────┬──────────────────────────┘
       │ Consensus
       ▼
┌─────────────────────────────────┐
│   GuardMesh Contracts           │
│   • Registry (Policy)           │
│   • Audit (Decisions)           │
└──────┬──────────────────────────┘
       │ Merkle Root
       ▼
┌─────────────────────────────────┐
│   0G Storage                    │
│   • Intent Bundle               │
│   • Guardian Verdicts           │
│   • Verification Proof          │
└─────────────────────────────────┘
```

## Configuration

GuardMesh CLI uses two configuration sources:

1. **Local `.env`** (project-specific)
2. **Global config** (`~/.guardmesh/config.json`)

Local configuration takes precedence.

### Environment Variables

```bash
# Agent Configuration
AGENT_ID=my-agent-01
GUARDIAN_ENDPOINT=http://127.0.0.1:9002

# Blockchain Configuration
RPC_URL=https://evmrpc-testnet.0g.ai
REGISTRY_ADDRESS=0x...
AUDIT_ADDRESS=0x...

# Optional: Private key for signing
PRIVATE_KEY=0x...
```

## Examples

### Example 1: Code Review Agent

```bash
# Initialize
guardmesh init code-reviewer --template code-analyzer

# Register
guardmesh agent register \
  -i code-reviewer-01 \
  -r code_analysis_only \
  -a "read_file,code_analysis"

# Test
guardmesh test action \
  -a code-reviewer-01 \
  --action read_file \
  --target src/auth.ts

# Deploy
guardmesh deploy
```

### Example 2: Analytics Bot

```bash
# Initialize
guardmesh init analytics-bot --template data-bot

# Register with strict permissions
guardmesh agent register \
  -i analytics-bot-01 \
  -r analytics_readonly \
  -a "query_db" \
  -d "change_permissions,export_pii"

# Test policy
guardmesh test policy -a analytics-bot-01

# Watch audit feed
guardmesh audit watch -a analytics-bot-01
```

## Development

Build from source:

```bash
git clone https://github.com/yourusername/guardmesh-cli
cd guardmesh-cli
npm install
npm run build
npm link
```

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## License

MIT

## Links

- [GuardMesh Documentation](https://github.com/yourusername/guardmesh)
- [0G Network](https://0g.ai)
- [AXL Mesh](https://github.com/yourusername/axl)
- [Discord Community](https://discord.gg/guardmesh)

---

Built with ❤️ for the 0G Hackathon - Best Agent Framework Track
