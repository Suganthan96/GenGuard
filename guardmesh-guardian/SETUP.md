# GuardMesh Guardian - Complete Setup Guide

## Quick Start (5 Minutes)

### 1. Install Dependencies
```bash
cd guardmesh-guardian
npm install
```

### 2. Get 0G Testnet Tokens

You need 0G testnet tokens to use the inference service. Here are your options:

**Option A: Use 0G Faucet (Recommended)**
1. Visit: https://faucet.0g.ai/
2. Connect your wallet (MetaMask)
3. Request testnet tokens (you'll get ~10 0G)

**Option B: Use Discord Faucet**
1. Join 0G Discord: https://discord.gg/0glabs
2. Go to #faucet channel
3. Request tokens with: `/faucet <your_wallet_address>`

**Option C: Use Your Own Funded Wallet**
If you already have a wallet with 0G testnet tokens, use that private key in `.env`

### 3. Configure Environment

Edit `.env` file:
```env
PRIVATE_KEY=your_private_key_with_funds_here
PROVIDER_ADDRESS=0xa48f01287233509FD694a22Bf840225062E67836
RPC_URL=https://evmrpc-testnet.0g.ai
GUARDIAN_ID=guardian-1
```

### 4. Fund Your Account

```bash
# Install CLI
npm install -g @0glabs/0g-serving-broker

# Setup network
0g-compute-cli setup-network
# Select: Testnet

# Login
0g-compute-cli login
# Enter your private key when prompted

# Create account and deposit (minimum 3 0G)
0g-compute-cli deposit --amount 10

# Transfer to provider (minimum 1 0G)
0g-compute-cli transfer-fund --provider 0xa48f01287233509FD694a22Bf840225062E67836 --amount 2

# Verify
0g-compute-cli get-account
```

### 5. Run Test

```bash
npm run test:simple
```

Expected output:
```
✅ SUCCESS: Guardian correctly blocked the Meta incident!
```

## What Just Happened?

1. **Guardian initialized** - Connected to 0G Compute Network
2. **Provider verified** - Confirmed qwen-2.5-7b-instruct is accessible
3. **Intent evaluated** - Sent Meta incident scenario to LLM in TEE
4. **Verdict received** - Got structured JSON response with 3 checks
5. **TEE verified** - Cryptographically proved verdict came from genuine TEE

## Next Steps

### Run Full Test Suite
```bash
npm test
```

This tests 4 scenarios:
- ❌ Meta incident (forum post) - Should BLOCK
- ❌ Meta incident (permission change) - Should BLOCK  
- ✅ Legitimate code analysis - Should APPROVE
- ✅ Legitimate database query - Should APPROVE

### Start Guardian Service
```bash
npm start
```

### Integrate with AXL

See `README.md` for AXL integration code.

## Troubleshooting

### "Account does not exist"
```bash
0g-compute-cli deposit --amount 10
```

### "Insufficient balance"
```bash
# Check balance
0g-compute-cli get-account

# Add more funds
0g-compute-cli deposit --amount 10
0g-compute-cli transfer-fund --provider 0xa48f01287233509FD694a22Bf840225062E67836 --amount 2
```

### "Too many requests (429)"
Wait 2-3 seconds between requests. Rate limit: 30 req/min.

### "Provider health: Critical"
The provider may be temporarily down. The endpoint is still accessible for testing. For production, consider using multiple providers or the router service.

### TEE Verification Returns False
This is a warning, not an error. The verdict is still valid. TEE verification may fail if:
- Provider is under maintenance
- Network latency issues
- TEE attestation service temporarily unavailable

The guardian will still return a valid verdict with `teeVerified: false`.

## Cost Estimation

Based on 0G Compute pricing:
- Input: 0.05 0G per 1M tokens
- Output: 0.10 0G per 1M tokens

Typical guardian evaluation:
- Input: ~500 tokens (intent + system prompt)
- Output: ~100 tokens (verdict JSON)
- Cost per evaluation: ~0.000035 0G ($0.0001 USD at $3/0G)

With 2 0G transferred to provider:
- ~57,000 evaluations possible
- More than enough for hackathon demo

## Architecture

```
┌─────────────────┐
│  Primary Agent  │
│  (wants action) │
└────────┬────────┘
         │ Intent
         ▼
┌─────────────────┐
│   AXL Network   │ ← P2P mesh (Gensyn)
└────────┬────────┘
         │ Broadcast
         ▼
┌─────────────────┐
│ Guardian Agent  │ ← This code
└────────┬────────┘
         │ Evaluate
         ▼
┌─────────────────┐
│  0G Compute     │
│  qwen-2.5-7b    │ ← LLM in TEE
│  (TEE verified) │
└────────┬────────┘
         │ Verdict
         ▼
┌─────────────────┐
│ Consensus       │
│ (3 guardians)   │
└────────┬────────┘
         │ Decision
         ▼
┌─────────────────┐
│ Execute/Block   │
└─────────────────┘
```

## Demo Checklist

- [x] Guardian agent code complete
- [x] 0G Compute integration working
- [x] TEE verification implemented
- [x] Meta incident test passing
- [ ] Deploy 3 guardian nodes
- [ ] Integrate with AXL network
- [ ] Implement consensus engine
- [ ] Add 0G Storage audit trail
- [ ] Connect smart contracts
- [ ] Build dashboard UI

## Support

- 0G Docs: https://docs.0g.ai
- 0G Discord: https://discord.gg/0glabs
- Gensyn AXL: See `../axl/README.md`
