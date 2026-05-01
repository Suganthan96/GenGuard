import { ethers } from "ethers";

const rpc = process.env.ZG_RPC_ENDPOINT || "https://evmrpc-testnet.0g.ai";
const minBalanceRaw = process.env.MIN_BALANCE_0G || "0";

function errMsg(error) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

function normalizePrivateKey(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "";
  }
  return value.startsWith("0x") ? value : `0x${value}`;
}

function resolveWalletAddress() {
  const explicitAddress = String(process.env.WALLET_ADDRESS || "").trim();
  if (explicitAddress) {
    if (!ethers.isAddress(explicitAddress)) {
      throw new Error("WALLET_ADDRESS must be a valid EVM address");
    }
    return { address: explicitAddress, source: "WALLET_ADDRESS" };
  }

  const privateKey = normalizePrivateKey(process.env.PRIVATE_KEY);
  if (privateKey) {
    if (!ethers.isHexString(privateKey, 32)) {
      throw new Error("PRIVATE_KEY must be a 32-byte hex key (with or without 0x prefix)");
    }
    return { address: new ethers.Wallet(privateKey).address, source: "PRIVATE_KEY" };
  }

  throw new Error("Set WALLET_ADDRESS or PRIVATE_KEY");
}

async function main() {
  const { address: walletAddress, source } = resolveWalletAddress();

  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(minBalanceRaw)) {
    throw new Error("MIN_BALANCE_0G must be a positive decimal number");
  }

  const minBalanceWei = ethers.parseEther(minBalanceRaw);
  const provider = new ethers.JsonRpcProvider(rpc);
  const balance = await provider.getBalance(walletAddress);

  console.log(`source=${source}`);
  console.log(`Wallet: ${walletAddress}`);
  console.log(`Balance: ${ethers.formatEther(balance)} 0G`);
  console.log(`Balance (wei): ${balance.toString()}`);

  if (balance === 0n) {
    console.log("\nNo funds! You need testnet 0G tokens.");
    console.log("Get testnet tokens from: https://faucet.0g.ai");
    process.exit(2);
  }

  if (balance < minBalanceWei) {
    console.log(`\nBalance below threshold. required_0g=${minBalanceRaw}`);
    process.exit(2);
  }

  console.log("\nWallet has sufficient funds.");
}

main().catch((error) => {
  console.error(`balance_check_failed=${errMsg(error)}`);
  process.exit(1);
});
