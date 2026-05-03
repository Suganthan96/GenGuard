export interface AgentTemplate {
  agentConfig: string;
  agentCode: string;
  policyConfig: string;
  packageJson: (name: string) => string;
  envExample: string;
  readme: (name: string) => string;
}

export function getTemplate(type: string): AgentTemplate {
  switch (type) {
    case 'code-analyzer':
      return codeAnalyzerTemplate;
    case 'data-bot':
      return dataBotTemplate;
    default:
      return customTemplate;
  }
}

const customTemplate: AgentTemplate = {
  agentConfig: `# GuardMesh Agent Configuration
agentId: my-agent-01
roleScope: custom_role
consensusType: majority

allowedActions:
  - read_file
  - query_db

deniedActions:
  - change_permissions
  - export_pii

dataSources:
  - internal_docs
  - metrics_readonly
`,

  agentCode: `import axios from 'axios';

interface GuardMeshIntent {
  agentId: string;
  actionType: string;
  target: string;
  payload?: any;
  timestamp: number;
}

class GuardMeshAgent {
  private agentId: string;
  private guardianEndpoint: string;

  constructor(agentId: string, guardianEndpoint = 'http://127.0.0.1:9002') {
    this.agentId = agentId;
    this.guardianEndpoint = guardianEndpoint;
  }

  async requestAction(actionType: string, target: string, payload?: any): Promise<boolean> {
    const intent: GuardMeshIntent = {
      agentId: this.agentId,
      actionType,
      target,
      payload,
      timestamp: Date.now(),
    };

    try {
      const response = await axios.post(\`\${this.guardianEndpoint}/a2a/send\`, {
        intent,
      });

      return response.data.verdict === 'approve';
    } catch (error) {
      console.error('Failed to get guardian approval:', error);
      return false;
    }
  }

  async performAction(actionType: string, target: string, payload?: any) {
    console.log(\`Requesting approval for: \${actionType} on \${target}\`);
    
    const approved = await this.requestAction(actionType, target, payload);

    if (!approved) {
      throw new Error('Action blocked by guardians');
    }

    console.log('Action approved by guardians');
    
    // Implement your action logic here
    // ...
  }
}

// Example usage
async function main() {
  const agent = new GuardMeshAgent('my-agent-01');

  try {
    await agent.performAction('read_file', 'config.json');
    console.log('Action completed successfully');
  } catch (error) {
    console.error('Action failed:', error);
  }
}

main();
`,

  policyConfig: `# Agent Policy Configuration
agentId: my-agent-01
roleScope: custom_role

# Actions this agent is explicitly allowed to perform
allowedActions:
  - read_file
  - query_db

# Actions this agent is explicitly denied
deniedActions:
  - change_permissions
  - export_pii

# Data sources the agent can access
dataSources:
  - internal_docs
  - metrics_readonly

# Consensus requirement (unanimous, majority, any)
consensusType: majority
`,

  packageJson: (name: string) => `{
  "name": "${name}",
  "version": "1.0.0",
  "description": "GuardMesh governed agent",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "axios": "^1.6.7",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^20.11.24",
    "typescript": "^5.3.3",
    "tsx": "^4.7.1"
  }
}
`,

  envExample: `# GuardMesh Configuration
AGENT_ID=my-agent-01
GUARDIAN_ENDPOINT=http://127.0.0.1:9002

# Blockchain Configuration
RPC_URL=https://evmrpc-testnet.0g.ai
REGISTRY_ADDRESS=0x...
AUDIT_ADDRESS=0x...

# Optional: Private key for signing transactions
# PRIVATE_KEY=0x...
`,

  readme: (name: string) => `# ${name}

A GuardMesh governed AI agent built with the GuardMesh framework.

## Overview

This agent is governed by the GuardMesh protocol, which provides:
- **Decentralized governance** via guardian nodes
- **TEE-verified decisions** using 0G Compute
- **Immutable audit trail** on 0G Storage
- **Policy enforcement** at the protocol level

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Configure environment:
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

3. Register your agent:
\`\`\`bash
guardmesh agent register -i my-agent-01 -r custom_role
\`\`\`

4. Test your agent:
\`\`\`bash
guardmesh test action -a my-agent-01 --action read_file --target test.txt
\`\`\`

## Usage

Run your agent:
\`\`\`bash
npm run dev
\`\`\`

Monitor audit trail:
\`\`\`bash
guardmesh audit watch -a my-agent-01
\`\`\`

## Architecture

This agent integrates with:
- **GuardMesh Registry**: Agent policy management
- **GuardMesh Audit**: Immutable decision log
- **AXL Mesh**: P2P guardian communication
- **0G Storage**: Decentralized audit storage
- **0G Compute**: TEE-verified inference

## Learn More

- [GuardMesh Documentation](https://github.com/yourusername/guardmesh)
- [0G Network](https://0g.ai)
- [Agent Framework Guide](https://github.com/yourusername/guardmesh/docs)
`,
};

const codeAnalyzerTemplate: AgentTemplate = {
  ...customTemplate,
  agentConfig: `agentId: code-analyzer-01
roleScope: code_analysis_only
consensusType: unanimous

allowedActions:
  - read_file
  - code_analysis
  - query_db

deniedActions:
  - write_file
  - change_permissions
  - forum_post

dataSources:
  - source_code
  - metrics_readonly
`,
  policyConfig: customTemplate.policyConfig.replace('my-agent-01', 'code-analyzer-01').replace('custom_role', 'code_analysis_only'),
};

const dataBotTemplate: AgentTemplate = {
  ...customTemplate,
  agentConfig: `agentId: data-bot-01
roleScope: analytics_readonly
consensusType: majority

allowedActions:
  - query_db
  - read_file

deniedActions:
  - change_permissions
  - export_pii
  - write_file

dataSources:
  - user_metrics_table
  - analytics_db
`,
  policyConfig: customTemplate.policyConfig.replace('my-agent-01', 'data-bot-01').replace('custom_role', 'analytics_readonly'),
};
