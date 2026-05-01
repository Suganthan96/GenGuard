# GuardMesh Guardian Agent

Guardian agent implementation for GuardMesh using 0G Compute Network with qwen-2.5-7b-instruct and TEE verification.

## Features

- ✅ Evaluates AI agent intents using 0G Compute (qwen-2.5-7b-instruct)
- ✅ Three-check evaluation: Role, Permission, Content
- ✅ TEE attestation verification for trustless verdicts
- ✅ Integration with AXL P2P network
- ✅ Automatic account balance monitoring
- ✅ Error handling with safe defaults (BLOCK on error)

## Prerequisites

1. Node.js >= 22.0.0
2. 0G testnet wallet with funds
3. AXL node running (for production integration)

## Installation

```bash
cd guardmesh-guardian
npm install
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your configuration:
```env
PRIVATE_KEY=your_private_key_here
PROVIDER_ADDRESS=0xa48f01287233509FD694a22Bf840225062E67836
RPC_URL=https://evmrpc-testnet.0g.ai
GUARDIAN_ID=guardian-1
```

## Setup 0G Account

Before running the guardian, you need to fund your 0G account:

```bash
# Install CLI globally
npm install -g @0glabs/0g-serving-broker

# Setup network
0g-compute-cli setup-network

# Login with your wallet
0g-compute-cli login

# Deposit funds (minimum 3 0G for account creation)
0g-compute-cli deposit --amount 10

# Transfer to provider (minimum 1 0G)
0g-compute-cli transfer-fund --provider 0xa48f01287233509FD694a22Bf840225062E67836 --amount 2
```

## Usage

### Run Tests

Test the guardian with sample intents (including Meta incident scenarios):

```bash
npm test
```

This will run 4 test scenarios:
1. Meta Incident - Forum Post (should BLOCK)
2. Meta Incident - Permission Change (should BLOCK)
3. Legitimate Code Analysis (should APPROVE)
4. Legitimate Database Query (should APPROVE)

### Start Guardian Service

```bash
npm start
```

The guardian will:
1. Initialize connection to 0G Compute
2. Verify provider accessibility
3. Check account balances
4. Wait for intents from AXL network

### Programmatic Usage

```javascript
import GuardianAgent from "./guardian.js";

const guardian = new GuardianAgent();
await guardian.initialize();

// Evaluate an intent
const intent = {
  agent_id: "eng-assistant-04",
  action_type: "forum_post",
  target: "internal-engineering-forum",
  content: "...",
  data_touched: ["user_metrics_table"],
  role_scope: "code_analysis_only"
};

const result = await guardian.evaluateIntent(intent);

console.log("Verdict:", result.verdict.verdict);
console.log("TEE Verified:", result.teeVerified);
console.log("Reason:", result.verdict.reason);
```

## Response Format

```javascript
{
  guardian_id: "guardian-1",
  timestamp: "2024-01-15T10:30:00.000Z",
  verdict: {
    role_check: "PASS" | "FAIL",
    permission_check: "PASS" | "FAIL",
    content_check: "PASS" | "FAIL",
    verdict: "APPROVE" | "BLOCK",
    reason: "one sentence explanation"
  },
  teeVerified: true | false,
  chatID: "abc123...",
  model: "qwen/qwen-2.5-7b-instruct"
}
```

## Integration with AXL

To integrate with your AXL network:

```javascript
import GuardianAgent from "./guardian.js";
import fetch from "node-fetch";

const guardian = new GuardianAgent();
await guardian.initialize();

// Poll for intents from AXL
async function pollAXL() {
  const response = await fetch("http://127.0.0.1:9002/recv");
  
  if (response.status === 200) {
    const fromPeerId = response.headers.get("X-From-Peer-Id");
    const intentData = await response.json();
    
    // Evaluate intent
    const result = await guardian.processAXLIntent(fromPeerId, intentData);
    
    // Send verdict back over AXL
    await fetch("http://127.0.0.1:9002/send", {
      method: "POST",
      headers: {
        "X-Destination-Peer-Id": fromPeerId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(result)
    });
  }
  
  setTimeout(pollAXL, 100);
}

pollAXL();
```

## Troubleshooting

### Error: Account does not exist
```bash
0g-compute-cli deposit --amount 10
```

### Error: Insufficient balance
```bash
0g-compute-cli transfer-fund --provider 0xa48f01287233509FD694a22Bf840225062E67836 --amount 2
```

### Error: Too many requests (429)
Wait a few seconds between requests. Rate limit: 30 requests/min, 5 concurrent.

### TEE Verification Failed
This is a warning, not an error. The verdict is still valid, but cryptographic proof is unavailable. Check provider health status.

## Architecture

```
Intent → Guardian Agent → 0G Compute (qwen-2.5-7b-instruct in TEE)
                              ↓
                         LLM Evaluation
                              ↓
                    Verdict + TEE Signature
                              ↓
                      processResponse()
                              ↓
                    Verified Verdict → AXL
```

## Next Steps

1. ✅ Test guardian with sample intents
2. ⬜ Integrate with AXL network polling
3. ⬜ Deploy 3 guardian nodes
4. ⬜ Implement consensus engine
5. ⬜ Add 0G Storage for audit trail
6. ⬜ Connect to smart contracts

## License

MIT
