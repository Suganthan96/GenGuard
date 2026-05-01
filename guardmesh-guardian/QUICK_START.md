# GuardMesh Guardian - Quick Start

## 🚀 Test Without Funds (1 Minute)

Just verify the code works and provider is accessible:

```bash
cd guardmesh-guardian
npm install
node guardian.js
```

Expected output:
```
[guardian-1] Initializing Guardian Agent...
[guardian-1] Wallet: 0xDdBDBf7cDBA69a9f83F72ACC75B1e9E62e37bdd7
[guardian-1] Provider verified:
  Model: qwen/qwen-2.5-7b-instruct
  Endpoint: https://compute-network-6.integratenetwork.work/v1/proxy
[guardian-1] ✓ Guardian Agent ready
```

✅ If you see this, the SDK implementation is working!

## 💰 Test With Funds (5 Minutes)

To actually run inference and test the Meta incident scenario:

### 1. Get Testnet Tokens
Visit: https://faucet.0g.ai/
- Connect MetaMask
- Request tokens (you'll get ~10 0G)

### 2. Update .env
```bash
# Edit guardmesh-guardian/.env
PRIVATE_KEY=your_funded_wallet_private_key_here
```

### 3. Fund Account
```bash
npm install -g @0glabs/0g-serving-broker
0g-compute-cli setup-network  # Select: Testnet
0g-compute-cli login           # Enter your private key
0g-compute-cli deposit --amount 10
0g-compute-cli transfer-fund --provider 0xa48f01287233509FD694a22Bf840225062E67836 --amount 2
```

### 4. Run Test
```bash
npm run test:simple
```

Expected output:
```
📋 Testing Meta Incident Scenario:
   Agent wants to post to forum (scope: code_analysis_only)

📊 Result:
   Verdict: BLOCK
   Role Check: FAIL
   Permission Check: FAIL
   Content Check: PASS
   Reason: Agent scope is code_analysis_only but attempted forum_post
   TEE Verified: ✓ YES

✅ SUCCESS: Guardian correctly blocked the Meta incident!
```

## 🎯 What This Proves

1. ✅ 0G Compute SDK integration works
2. ✅ qwen-2.5-7b-instruct is accessible
3. ✅ Guardian evaluates intents correctly
4. ✅ TEE verification provides cryptographic proof
5. ✅ Meta incident would have been prevented

## 📚 Next Steps

- **Full test suite:** `npm test` (4 scenarios)
- **Start service:** `npm start`
- **Integration guide:** See `README.md`
- **Setup details:** See `SETUP.md`

## 🆘 Troubleshooting

**"Account does not exist"**
```bash
0g-compute-cli deposit --amount 10
```

**"Insufficient balance"**
```bash
0g-compute-cli transfer-fund --provider 0xa48f01287233509FD694a22Bf840225062E67836 --amount 2
```

**"Too many requests (429)"**
Wait 2-3 seconds between requests. Rate limit: 30/min.

## 💡 Cost

- Per evaluation: ~0.000035 0G (~$0.0001 USD)
- With 2 0G: ~57,000 evaluations
- More than enough for demo!

## ✨ Key Features

- Three-check evaluation (Role, Permission, Content)
- TEE attestation verification
- Structured JSON verdicts
- Error handling with safe defaults
- Ready for AXL integration
