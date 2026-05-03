# GuardMesh

> Decentralized Governance Framework for AI Agents on 0G

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![0G Hackathon](https://img.shields.io/badge/0G-Hackathon-blue)](https://0g.ai)

GuardMesh is a complete framework for building governed AI agents with decentralized policy enforcement, TEE-verified decisions, and immutable audit trails on the 0G network.

## 🎯 Problem

AI agents today operate without oversight:
- ❌ No accountability for actions
- ❌ No policy enforcement
- ❌ No audit trail
- ❌ Single point of failure

## ✨ Solution

GuardMesh provides:
- ✅ **Decentralized Governance**: Multiple guardian nodes vote on agent actions
- ✅ **TEE Verification**: Decisions verified in Trusted Execution Environments (0G Compute)
- ✅ **Immutable Audit**: All decisions stored permanently on 0G Storage
- ✅ **Developer-Friendly**: Simple CLI for building governed agents

## 🚀 Quick Start

```bash
# Install CLI
npm install -g @guardmesh/cli

# Create agent
guardmesh init my-agent --template code-analyzer
cd my-agent

# Configure
guardmesh config --rpc https://evmrpc-testnet.0g.ai
guardmesh config --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3
guardmesh config --audit 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

# Register
guardmesh agent register -i my-agent-01 -r code_analysis_only

# Test
guardmesh test action -a my-agent-01 --action read_file --target test.txt

# Deploy
guardmesh deploy
```

## 📦 What's Included

### 1. GuardMesh CLI (`guardmesh-cli/`)

Complete command-line framework for building governed agents:

```bash
guardmesh init          # Initialize project
guardmesh agent         # Manage agents
guardmesh test          # Test actions
guardmesh deploy        # Deploy agent
guardmesh audit         # Query audit trail
guardmesh guardians     # Manage guardians
```

[📖 CLI Documentation](guardmesh-cli/README.md)

### 2. Smart Contracts (`0g-contracts/`)

On-chain governance infrastructure:

- **GuardMeshRegistry**: Agent policy management
- **GuardMeshAudit**: Immutable decision recording
- **GuardMeshRegistry-ENS**: Guardian identity resolution

**Deployed on 0G Testnet**:
- Registry: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- Audit: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- ENS: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`

### 3. Guardian Mesh (`axl/`)

P2P communication layer for guardian nodes:

- TLS-secured mesh network
- A2A (Agent-to-Agent) protocol
- MCP integration
- Topology management

**Guardian Nodes**:
- Guardian 1: `guardian-1.guardmesh.eth` (Port 9002)
- Guardian 2: `guardian-2.guardmesh.eth` (Port 9012)
- Guardian 3: `guardian-3.guardmesh.eth` (Port 9022)

### 4. Web Dashboard (`Web/`)

Real-time monitoring interface:

- System overview
- Guardian status with ENS names
- Live activity feed
- Audit trail with 0G verification
- Policy editor

[🌐 View Dashboard](http://localhost:3000)

## 🏗️ Architecture

```
┌─────────────┐
│   Agent     │ ◄── Built with GuardMesh CLI
└──────┬──────┘
       │ Intent
       ▼
┌─────────────────────────────────┐
│     Guardian Mesh (AXL)         │
│  ┌─────┐  ┌─────┐  ┌─────┐    │
│  │ G1  │  │ G2  │  │ G3  │    │ ◄── TEE (0G Compute)
│  └─────┘  └─────┘  └─────┘    │
└──────┬──────────────────────────┘
       │ Consensus
       ▼
┌─────────────────────────────────┐
│   Contracts (0G EVM)            │
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

[📐 Full Architecture](ARCHITECTURE.md)

## 🎓 Documentation

- [CLI Documentation](guardmesh-cli/README.md) - Complete CLI reference
- [Framework Guide](guardmesh-cli/FRAMEWORK_GUIDE.md) - Building agents
- [Quick Start](guardmesh-cli/examples/quickstart.md) - 5-minute tutorial
- [Architecture](ARCHITECTURE.md) - System design
- [API Reference](guardmesh-cli/docs/API.md) - API documentation
- [Contributing](guardmesh-cli/CONTRIBUTING.md) - Contribution guide

## 💡 Use Cases

### Code Review Agent
```bash
guardmesh init code-reviewer --template code-analyzer
```
**Allowed**: Read code, analyze, suggest improvements  
**Denied**: Modify code, access production

### Data Analytics Agent
```bash
guardmesh init analytics-bot --template data-bot
```
**Allowed**: Query databases, read metrics  
**Denied**: Export PII, modify data

### Custom Agent
```bash
guardmesh init my-agent --template custom
```
Define your own policies and permissions

## 🔗 0G Integration

### 0G Storage
All audit decisions stored with:
- Intent payload
- Guardian verdicts
- TEE proofs
- Merkle tree

### 0G Compute
Guardians use TEE-verified inference:
- Model: `qwen-2.5-7b-instruct`
- Sealed execution
- Cryptographic proof

### 0G EVM
Smart contracts for:
- Agent policies
- Decision recording
- ENS integration

## 🛠️ Development

### Prerequisites
- Node.js 18+
- Go 1.21+
- 0G testnet access

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/guardmesh
cd guardmesh

# Install CLI
cd guardmesh-cli
npm install
npm run build
npm link

# Start guardians
cd ../axl
./start-guardian-1.ps1
./start-guardian-2.ps1
./start-guardian-3.ps1

# Deploy contracts (if needed)
cd ../0g-contracts
npm install
npx hardhat run scripts/deploy.js --network 0g-testnet

# Start dashboard
cd ../Web
npm install
npm run dev
```

## 📊 Project Structure

```
guardmesh/
├── guardmesh-cli/          # CLI Framework
│   ├── src/               # Source code
│   ├── examples/          # Examples
│   └── docs/              # Documentation
├── 0g-contracts/          # Smart Contracts
│   ├── contracts/         # Solidity contracts
│   ├── scripts/           # Deployment scripts
│   └── deployments/       # Deployment info
├── axl/                   # Guardian Mesh
│   ├── api/              # HTTP API
│   ├── internal/         # Core logic
│   └── examples/         # Client examples
├── Web/                   # Dashboard
│   ├── app/              # Next.js app
│   ├── components/       # UI components
│   └── lib/              # Utilities
├── ARCHITECTURE.md        # Architecture doc
└── HACKATHON_SUBMISSION.md # Submission
```

## 🎯 Hackathon Submission

**Track**: 🛠️ Best Agent Framework, Tooling & Core Extensions

**What We Built**:
- ✅ Complete CLI framework
- ✅ Smart contracts on 0G EVM
- ✅ Guardian mesh with TEE
- ✅ 0G Storage integration
- ✅ Web dashboard
- ✅ Agent templates
- ✅ Documentation

[📄 Full Submission](HACKATHON_SUBMISSION.md)

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](guardmesh-cli/CONTRIBUTING.md) for guidelines.

Areas of focus:
- New agent templates
- Guardian improvements
- CLI enhancements
- Documentation
- Testing

## 📝 License

MIT License - see [LICENSE](guardmesh-cli/LICENSE)

## 🔗 Links

- **GitHub**: https://github.com/yourusername/guardmesh
- **Documentation**: https://docs.guardmesh.io
- **Discord**: https://discord.gg/guardmesh
- **Twitter**: [@guardmesh](https://twitter.com/guardmesh)
- **0G Network**: https://0g.ai

## 👥 Team

- **Name**: [Your Name]
- **Telegram**: [@yourtelegram]
- **X**: [@yourtwitter]
- **GitHub**: [@yourgithub]

## 🙏 Acknowledgments

Built for the 0G Hackathon - Best Agent Framework Track

Special thanks to:
- 0G Network team
- OpenClaw community
- All contributors

---

**GuardMesh: Making AI Agents Trustworthy, Accountable, and Safe**

Built with ❤️ on 0G
