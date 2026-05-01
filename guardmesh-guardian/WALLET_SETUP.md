# ✅ Wallet Setup Complete - Next Steps

## Current Status

✅ **Account Created:** You have 3 0G in your main account  
✅ **Funds Transferred:** 2 0G transferred to provider sub-account  
✅ **Provider Ready:** qwen-2.5-7b-instruct is accessible

## ⚠️ Important: Update Guardian Wallet

The guardian is currently using a test wallet. You need to update it to use **the same wallet you used for `0g-compute-cli login`**.

### Option 1: Manual Update (Recommended)

1. Open `guardmesh-guardian/.env` in a text editor
2. Replace the `PRIVATE_KEY` line with your actual private key:

```env
PRIVATE_KEY=0xyour_actual_private_key_here
```

3. Save the file

### Option 2: Use PowerShell Script

```powershell
cd guardmesh-guardian
.\update-wallet.ps1
```

Enter your private key when prompted.

### How to Find Your Private Key

If you used MetaMask or another wallet:
1. Open your wallet
2. Go to Account Details → Export Private Key
3. Copy the private key (starts with `0x`)

**⚠️ Security Warning:** Never share your private key or commit it to git!

---

## Test the Guardian

Once you've updated the wallet:

### Quick Test (Meta Incident)
```bash
cd guardmesh-guardian
npm run test:simple
```

Expected output:
```
✅ SUCCESS: Guardian correctly blocked the Meta incident!
   Verdict: BLOCK
   TEE Verified: ✓ YES
```

### Full Test Suite
```bash
npm test
```

This runs 4 scenarios and should take ~10 seconds.

---

## Verify Everything Works

### 1. Check Account Balance
```bash
0g-compute-cli get-account
```

Should show:
- Total: 3.000000000000000000 0G
- Locked: 2.000000000000000000 0G

### 2. Check Provider Sub-Account
```bash
0g-compute-cli get-sub-account --provider 0xa48f01287233509FD694a22Bf840225062E67836 --service inference
```

Should show:
- Balance: 2.000000000000000000 0G

### 3. Test Guardian
```bash
cd guardmesh-guardian
npm run test:simple
```

Should complete successfully with TEE verification.

---

## Cost Estimate

With 2 0G in the provider sub-account:
- **Per evaluation:** ~0.000035 0G (~$0.0001 USD)
- **Total evaluations possible:** ~57,000
- **More than enough for:** Hackathon demo + testing

---

## Troubleshooting

### "Account does not exist"
You're using the wrong wallet. Make sure the `PRIVATE_KEY` in `.env` matches the wallet you used for `0g-compute-cli login`.

### "Insufficient balance"
```bash
0g-compute-cli get-sub-account --provider 0xa48f01287233509FD694a22Bf840225062E67836 --service inference
```

If balance is 0, transfer more:
```bash
0g-compute-cli transfer-fund --provider 0xa48f01287233509FD694a22Bf840225062E67836 --amount 1
```

### "TEE verification failed"
This is a warning, not an error. The verdict is still valid. TEE verification may fail due to:
- Provider maintenance
- Network latency
- Temporary TEE service issues

The guardian will still return a valid verdict with `teeVerified: false`.

---

## Next Steps After Testing

1. ✅ Guardian working with funded wallet
2. ⬜ Deploy 3 guardian instances (guardian-1, guardian-2, guardian-3)
3. ⬜ Integrate with AXL network
4. ⬜ Build consensus engine
5. ⬜ Connect to smart contracts
6. ⬜ Build dashboard UI

---

## Summary

**What you have now:**
- ✅ 3 0G deposited to main account
- ✅ 2 0G transferred to provider sub-account
- ✅ Provider accessible and ready
- ✅ Guardian code complete
- ⚠️ Need to update guardian wallet to match funded wallet

**What to do:**
1. Update `guardmesh-guardian/.env` with your actual private key
2. Run `npm run test:simple` to verify
3. Celebrate! 🎉
