a# GuardMesh Quick Start Guide

Complete guide to running the full GuardMesh system with 3 distributed guardians.

## Prerequisites Check

- [ ] AXL node binary built: `axl/node` exists
- [ ] 3 private keys exist: `axl/private.pem`, `axl/private-2.pem`, `axl/private-3.pem`
- [ ] 0G wallet funded (check: `cd axl/0g-check && node check-0g.mjs`)
- [ ] Guardian dependencies installed: `cd guardmesh-guardian && npm install`

## Terminal Setup (6 terminals needed)

### Terminal 1: AXL Node 1 (Hub)
```powershell
cd axl
.\start-guardian-1.ps1
```
Wait for: `TLS listener started on 127.0.0.1:9001` and `Listening on 127.0.0.1:9002`

### Terminal 2: AXL Node 2
```powershell
cd axl
.\start-guardian-2.ps1
```
Wait for: `Connected outbound` and `Listening on 127.0.0.1:9012`

### Terminal 3: AXL Node 3
```powershell
cd axl
.\start-guardian-3.ps1
```
Wait for: `Connected outbound` and `Listening on 127.0.0.1:9022`

### Verify Nodes Connected
```powershell
cd axl
python test-nodes.py
```
Should show all 3 nodes with `Connected peers: 1` or more.

---

### Terminal 4: Guardian Listener 1
```powershell
cd guardmesh-guardian
npm run listener:1
```
Wait for: `✓ Guardian Listener ready` and public key display

### Terminal 5: Guardian Listener 2
```powershell
cd guardmesh-guardian
npm run listener:2
```
Wait for: `✓ Guardian Listener ready` and public key display

### Terminal 6: Guardian Listener 3
```powershell
cd guardmesh-guardian
npm run listener:3
```
Wait for: `✓ Guardian Listener ready` and public key display

---

## Test the System

### Terminal 7: Run Integration Test
```powershell
cd guardmesh-guardian
npm run test:axl
```

Expected output:
```
Discovering guardian nodes...
Guardian 9002: Public Key: abcd1234...
Guardian 9012: Public Key: ef567890...
Guardian 9022: Public Key: 12345678...

Broadcasting intent...
✓ Sent to guardian abcd1234... (245 bytes)
✓ Sent to guardian ef567890... (245 bytes)
✓ Sent to guardian 12345678... (245 bytes)

Polling for verdicts...
✓ Received verdict from abcd1234...: BLOCK
✓ Received verdict from ef567890...: BLOCK
✓ Received verdict from 12345678...: BLOCK

📋 Consensus:
  BLOCK: 3
  APPROVE: 0
  ⛔ FINAL DECISION: BLOCKED (3/3 guardians blocked)
```

## What Just Happened?

1. **Intent Broadcast**: Test client sent Meta incident scenario to all 3 guardians via AXL
2. **Guardian Evaluation**: Each guardian independently evaluated using 0G Compute (qwen-2.5-7b-instruct)
3. **TEE Verification**: Each guardian verified the response came from a Trusted Execution Environment
4. **Verdict Collection**: All 3 verdicts returned via AXL network
5. **Consensus**: System determined final decision based on majority vote

## System Status

✅ **Phase 1**: Environment setup (partial - AXL nodes running)
✅ **Phase 2**: Smart contracts deployed
✅ **Phase 3**: AXL Intent Layer implemented
✅ **Phase 4**: Guardian Agent with 0G Compute working

## Next: Phase 5 - Consensus Engine

Build a standalone consensus service that:
- Collects verdicts from all guardians
- Applies voting logic (unanimous, majority, any-1)
- Returns final decision to primary agent
- Logs decision to smart contract

## Troubleshooting

**Problem**: Guardians not receiving intents
- Check all 6 terminals are running
- Verify `python test-nodes.py` shows connected peers
- Restart guardian listeners

**Problem**: TEE verification failing
- Check wallet balance: `cd axl/0g-check && node check-0g.mjs`
- Verify provider accessible
- Check `.env` has correct `PRIVATE_KEY`

**Problem**: Verdicts not returning
- Increase timeout in test: edit `test-axl-integration.js`, change `10000` to `30000`
- Check guardian listener logs for errors
- Verify all guardians completed evaluation

## Stopping the System

Press `Ctrl+C` in each terminal to gracefully shut down:
1. Stop guardian listeners (Terminals 4, 5, 6)
2. Stop AXL nodes (Terminals 1, 2, 3)

## Files Created

- `guardmesh-guardian/axl-intent-client.js` - Intent broadcaster
- `guardmesh-guardian/axl-guardian-listener.js` - Guardian listener
- `guardmesh-guardian/start-guardian-listener.js` - Listener startup script
- `guardmesh-guardian/test-axl-integration.js` - Integration test
- `axl/start-guardian-1.ps1` - Node 1 startup
- `axl/start-guardian-2.ps1` - Node 2 startup
- `axl/start-guardian-3.ps1` - Node 3 startup
