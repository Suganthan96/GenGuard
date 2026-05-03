# GuardMesh CLI Quick Reference

## Installation

```bash
npm install -g @guardmesh/cli
```

## Configuration

```bash
# Set RPC endpoint
guardmesh config --rpc https://evmrpc-testnet.0g.ai

# Set contract addresses
guardmesh config --registry 0xYourRegistryAddress
guardmesh config --audit 0xYourAuditAddress

# View configuration
guardmesh config --show
```

## Project Management

```bash
# Initialize new project
guardmesh init <name> [--template <type>]

# Templates: code-analyzer, data-bot, custom
guardmesh init my-agent --template code-analyzer
```

## Agent Management

```bash
# Register agent
guardmesh agent register \
  -i <agentId> \
  -r <roleScope> \
  [-a <allowedActions>] \
  [-d <deniedActions>]

# List all agents
guardmesh agent list

# Get agent details
guardmesh agent info <agentId>
```

## Testing

```bash
# Test single action
guardmesh test action \
  -a <agentId> \
  --action <actionType> \
  --target <resource> \
  [--payload <json>]

# Test policy
guardmesh test policy -a <agentId>
```

## Deployment

```bash
# Deploy agent
guardmesh deploy [--config <path>] [--dry-run]
```

## Audit Trail

```bash
# Watch live feed
guardmesh audit watch [-a <agentId>] [-o <outcome>]

# Query history
guardmesh audit history [-a <agentId>] [-l <limit>]

# Verify decision
guardmesh audit verify <merkleRoot>
```

## Guardian Management

```bash
# Check status
guardmesh guardians status

# Add guardian
guardmesh guardians add -p <pubkey> -e <ens> [--endpoint <url>]

# Remove guardian
guardmesh guardians remove <pubkey>
```

## Common Workflows

### Create and Deploy Agent

```bash
# 1. Initialize
guardmesh init my-agent --template code-analyzer
cd my-agent

# 2. Install dependencies
npm install

# 3. Configure
cp .env.example .env
# Edit .env

# 4. Register
guardmesh agent register -i my-agent-01 -r code_analysis_only

# 5. Test
guardmesh test action -a my-agent-01 --action read_file --target test.txt

# 6. Deploy
guardmesh deploy
```

### Monitor Agent

```bash
# Watch live activity
guardmesh audit watch -a my-agent-01

# Check guardian status
guardmesh guardians status

# Query recent history
guardmesh audit history -a my-agent-01 -l 50
```

### Verify Decision

```bash
# Get merkle root from audit
guardmesh audit history -a my-agent-01

# Verify on 0G Storage
guardmesh audit verify 0xabc123...
```

## Environment Variables

```bash
# Agent Configuration
AGENT_ID=my-agent-01
GUARDIAN_ENDPOINT=http://127.0.0.1:9002

# Blockchain
RPC_URL=https://evmrpc-testnet.0g.ai
REGISTRY_ADDRESS=0x...
AUDIT_ADDRESS=0x...
PRIVATE_KEY=0x...

# Optional
API_URL=http://localhost:3000
```

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - Configuration error
- `3` - Network error
- `4` - Contract error

## Tips

- Use `--dry-run` to preview changes
- Use `-h` or `--help` for command help
- Check logs in `~/.guardmesh/logs/`
- Config stored in `~/.guardmesh/config.json`

## Troubleshooting

### Command not found
```bash
npm link
```

### Connection refused
```bash
guardmesh guardians status
# Check guardian endpoints
```

### Transaction failed
```bash
guardmesh config --show
# Verify RPC and addresses
```

### Action blocked
```bash
guardmesh agent info <agentId>
# Check policy
```

## Links

- [Full Documentation](README.md)
- [Framework Guide](FRAMEWORK_GUIDE.md)
- [Quick Start](examples/quickstart.md)
- [Contributing](CONTRIBUTING.md)
